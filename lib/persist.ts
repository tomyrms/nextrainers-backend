// Persistence for the in-memory store (lib/store.ts), on top of lib/kv.ts.
//
// The whole store is one JSON blob (`store:snapshot`) plus a revision id
// (`store:rev`). store.ts registers a serializer and an applier at module
// init; route handlers are wrapped in withStore(), which
//   - before the handler: syncStore() re-reads the blob when another instance
//     wrote a newer revision (one tiny GET per request on Redis; a one-time
//     load on the local file backend),
//   - after the handler: flushStore() writes the blob when the handler mutated
//     the store, *before* the response is returned, so a serverless instance
//     that freezes right after cannot lose the write.
// Mutations outside a request (timers) are caught by persistSoon()'s debounced
// flush. All failures are logged once and swallowed: a missing/corrupt blob
// falls back to the seeds, and a failed save never crashes a request.
import { readFileSync } from "node:fs";
import path from "node:path";
import { connection } from "next/server";
import { kvGet, kvIsRemote, kvSetMany } from "./kv";

const SNAPSHOT_KEY = "store:snapshot";
const REV_KEY = "store:rev";
const DEBOUNCE_MS = 300;
// Pre-kv persistence file; imported once when the kv has no snapshot yet.
const LEGACY_FILE = path.join(process.cwd(), "data", "store.json");

export type Snapshot = Record<string, unknown>;

type PersistState = {
  provider: (() => Snapshot) | null;
  applier: ((snap: Snapshot) => void) | null;
  loaded: boolean;
  rev: string | null;
  dirty: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  flushing: Promise<void> | null;
  errorLogged: boolean;
};

const state: PersistState = {
  provider: null,
  applier: null,
  loaded: false,
  rev: null,
  dirty: false,
  timer: null,
  flushing: null,
  errorLogged: false,
};

// Log the first failure, then stay quiet so a broken backend cannot flood logs.
function logError(phase: string, error: unknown): void {
  if (state.errorLogged) return;
  state.errorLogged = true;
  console.error(`[persist] ${phase} failed (further persist errors muted):`, error);
}

// store.ts hands over a serializer for the current state; called on every save.
export function registerSnapshot(provider: () => Snapshot): void {
  state.provider = provider;
}

// store.ts hands over the function that overlays a saved snapshot.
export function registerApplier(applier: (snap: Snapshot) => void): void {
  state.applier = applier;
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

// Brings the in-memory store up to the latest saved revision.
export async function syncStore(): Promise<void> {
  if (state.loaded && !kvIsRemote) return; // single process owns the local file
  if (state.dirty || state.flushing) return; // never clobber unsaved local writes
  try {
    const rev = await kvGet(REV_KEY);
    if (state.loaded && rev === state.rev) return;
    const snap = rev ? parseSnapshot(await kvGet(SNAPSHOT_KEY)) : kvIsRemote ? null : readLegacyFile();
    if (snap) state.applier?.(snap);
    state.rev = rev;
    state.loaded = true;
  } catch (error) {
    logError("load", error);
  }
}

// Writes the snapshot now when there are unsaved mutations.
export async function flushStore(): Promise<void> {
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  if (state.flushing) {
    await state.flushing;
    if (!state.dirty) return;
  }
  if (!state.dirty || !state.provider) return;

  state.dirty = false;
  const rev = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  state.flushing = (async () => {
    try {
      await kvSetMany([
        [SNAPSHOT_KEY, JSON.stringify(state.provider!())],
        [REV_KEY, rev],
      ]);
      state.rev = rev;
      state.loaded = true;
    } catch (error) {
      logError("save", error);
    } finally {
      state.flushing = null;
    }
  })();
  await state.flushing;
}

// Marks the store dirty and schedules a debounced flush (covers mutations
// made outside withStore, e.g. timers).
export function persistSoon(): void {
  state.dirty = true;
  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = null;
    void flushStore();
  }, DEBOUNCE_MS);
}

// Wraps a route handler: always dynamic, sync before, flush after (see
// header comment).
export function withStore<A extends unknown[]>(
  handler: (...args: A) => Response | Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    await connection(); // store-backed responses are never prerendered
    await syncStore();
    try {
      return await handler(...args);
    } finally {
      await flushStore();
    }
  };
}
