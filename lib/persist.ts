// Per-account persistence for the store (lib/store.ts), on top of lib/kv.ts.
//
// Each tenant (an account, or "demo" for requests without a valid session)
// is one JSON blob plus a revision id in the KV:
//   demo     -> store:snapshot / store:rev          (pre-tenancy keys, kept)
//   user <id> -> store:u:<id>:snapshot / store:u:<id>:rev
//
// Route handlers are wrapped in withStore(), which
//   - resolves the tenant from the request's session (Bearer token or cookie),
//   - before the handler: syncStore() re-reads the tenant's blob when another
//     instance wrote a newer revision (one tiny GET per request on Redis; a
//     one-time load on the local file backend),
//   - runs the handler inside an AsyncLocalStorage scope so `store.x` (and
//     timers started by the handler) reach that tenant,
//   - after the handler: flushStore() writes the blob when it was mutated,
//     *before* the response is returned, so a serverless instance that
//     freezes right after cannot lose the write.
// Mutations outside withStore (timers) are caught by persistSoon()'s debounced
// flush. Failures are logged once and swallowed: a missing/corrupt blob falls
// back to the seeds, and a failed save never crashes a request.
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import path from "node:path";
import { connection } from "next/server";
import { getUserFromRequest } from "./auth";
import { kvGet, kvIsRemote, kvSetMany } from "./kv";

const DEMO_TENANT = "demo";
const DEBOUNCE_MS = 300;
// Clean tenants beyond this many are dropped from memory (reloaded on demand).
const MAX_CACHED_TENANTS = 200;
// Pre-kv persistence file; imported once for the demo tenant when the kv has
// no snapshot yet.
const LEGACY_FILE = path.join(process.cwd(), "data", "store.json");

export type Snapshot = Record<string, unknown>;

// What a fresh tenant state is built from.
export type TenantInit = { userId: string | null; email: string | null };

// Hooks registered by lib/store.ts (kept out of this module's imports so the
// two files do not depend on each other at load time).
type Codec<S> = {
  create: (init: TenantInit) => S;
  apply: (state: S, snap: Snapshot) => void;
  snapshot: (state: S) => Snapshot;
  makeTracker: (onMutate: () => void) => <T>(value: T) => T;
};

export type Tenant = {
  id: string;
  init: TenantInit;
  state: unknown;
  tracked: unknown;
  loaded: boolean;
  rev: string | null;
  dirty: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  flushing: Promise<void> | null;
};

let codec: Codec<unknown> | null = null;
const tenants = new Map<string, Tenant>();
const scope = new AsyncLocalStorage<Tenant>();
let errorLogged = false;

// Log the first failure, then stay quiet so a broken backend cannot flood logs.
function logError(phase: string, error: unknown): void {
  if (errorLogged) return;
  errorLogged = true;
  console.error(`[persist] ${phase} failed (further persist errors muted):`, error);
}

export function registerCodec<S>(hooks: Codec<S>): void {
  codec = hooks as unknown as Codec<unknown>;
}

function requireCodec(): Codec<unknown> {
  if (!codec) throw new Error("[persist] store codec not registered (import lib/store first)");
  return codec;
}

const snapshotKey = (t: Tenant) => (t.id === DEMO_TENANT ? "store:snapshot" : `store:u:${t.id}:snapshot`);
const revKey = (t: Tenant) => (t.id === DEMO_TENANT ? "store:rev" : `store:u:${t.id}:rev`);

// (Re)builds a tenant's state from the seeds, wrapped in its own tracker.
function resetState(tenant: Tenant): void {
  const { create, makeTracker } = requireCodec();
  tenant.state = create(tenant.init);
  tenant.tracked = makeTracker(() => markDirty(tenant))(tenant.state);
}

function evictClean(): void {
  if (tenants.size <= MAX_CACHED_TENANTS) return;
  for (const [id, tenant] of tenants) {
    if (tenants.size <= MAX_CACHED_TENANTS) break;
    if (id !== DEMO_TENANT && !tenant.dirty && !tenant.flushing && !tenant.timer) tenants.delete(id);
  }
}

function getTenant(init: TenantInit): Tenant {
  const id = init.userId ?? DEMO_TENANT;
  let tenant = tenants.get(id);
  if (!tenant) {
    tenant = {
      id,
      init,
      state: null,
      tracked: null,
      loaded: false,
      rev: null,
      dirty: false,
      timer: null,
      flushing: null,
    };
    resetState(tenant);
    tenants.set(id, tenant);
    evictClean();
  }
  return tenant;
}

// The tenant of the running request; the demo tenant outside any request.
export function currentTenant(): Tenant {
  return scope.getStore() ?? getTenant({ userId: null, email: null });
}

function parseSnapshot(text: string | null): Snapshot | null {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Snapshot;
  } catch (error) {
    logError("parse", error);
    return null;
  }
}

function readLegacyFile(): Snapshot | null {
  try {
    return parseSnapshot(readFileSync(LEGACY_FILE, "utf8"));
  } catch {
    return null;
  }
}

// Brings a tenant's in-memory state up to its latest saved revision.
async function syncStore(tenant: Tenant): Promise<void> {
  if (tenant.loaded && !kvIsRemote) return; // single process owns the local file
  if (tenant.dirty || tenant.flushing) return; // never clobber unsaved local writes
  try {
    const rev = await kvGet(revKey(tenant));
    if (tenant.loaded && rev === tenant.rev) return;
    let snap: Snapshot | null = null;
    if (rev) snap = parseSnapshot(await kvGet(snapshotKey(tenant)));
    else if (!kvIsRemote && tenant.id === DEMO_TENANT) snap = readLegacyFile();
    if (snap) {
      resetState(tenant);
      requireCodec().apply(tenant.state, snap);
    }
    tenant.rev = rev;
    tenant.loaded = true;
  } catch (error) {
    logError("load", error);
  }
}

// Writes a tenant's snapshot now when it has unsaved mutations.
async function flushStore(tenant: Tenant): Promise<void> {
  if (tenant.timer !== null) {
    clearTimeout(tenant.timer);
    tenant.timer = null;
  }
  if (tenant.flushing) {
    await tenant.flushing;
    if (!tenant.dirty) return;
  }
  if (!tenant.dirty) return;

  tenant.dirty = false;
  const rev = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  tenant.flushing = (async () => {
    try {
      await kvSetMany([
        [snapshotKey(tenant), JSON.stringify(requireCodec().snapshot(tenant.state))],
        [revKey(tenant), rev],
      ]);
      tenant.rev = rev;
      tenant.loaded = true;
    } catch (error) {
      logError("save", error);
    } finally {
      tenant.flushing = null;
    }
  })();
  await tenant.flushing;
}

// Marks a tenant dirty and schedules a debounced flush (covers mutations made
// outside withStore's request lifetime, e.g. timers).
function markDirty(tenant: Tenant): void {
  tenant.dirty = true;
  if (tenant.timer !== null) clearTimeout(tenant.timer);
  tenant.timer = setTimeout(() => {
    tenant.timer = null;
    void flushStore(tenant);
  }, DEBOUNCE_MS);
}

// Explicit "the current tenant changed" hook for routes that mutate raw
// object references pulled out of the store.
export function persistSoon(): void {
  markDirty(currentTenant());
}

// Wraps a route handler: always dynamic, resolves the tenant, syncs before,
// runs in the tenant's scope, flushes after (see header comment).
export function withStore<A extends unknown[]>(
  handler: (...args: A) => Response | Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    await connection(); // store-backed responses are never prerendered
    const req = args[0] instanceof Request ? args[0] : null;
    const user = req ? await getUserFromRequest(req) : null;
    const tenant = getTenant({ userId: user?.id ?? null, email: user?.email ?? null });
    await syncStore(tenant);
    return scope.run(tenant, async () => {
      try {
        return await handler(...args);
      } finally {
        await flushStore(tenant);
      }
    });
  };
}
