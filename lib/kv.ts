// Minimal async key-value layer shared by the store (lib/persist.ts) and auth
// (lib/auth.ts). Dependency-free; picks the first backend that is available:
//
//   1. Upstash Redis over its REST API when KV_REST_API_URL/KV_REST_API_TOKEN
//      (or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN) are set — what the
//      Vercel Marketplace integration injects. Shared by every instance.
//   2. A local JSON file (data/kv.json) — dev servers and CI, survives restarts.
//   3. Plain memory when the file cannot be written (read-only filesystem).
//
// Values are strings; callers JSON-encode. TTLs are honoured by every backend.
import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const REST_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

// True when state is shared across instances (callers must re-read per request).
export const kvIsRemote = Boolean(REST_URL && REST_TOKEN);

export function kvBackendName(): "redis" | "file" | "memory" {
  if (kvIsRemote) return "redis";
  return local().fileWritable ? "file" : "memory";
}

// ---------------------------------------------------------------- redis

type RestReply = { result?: unknown; error?: string };

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${REST_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const reply = (await res.json()) as RestReply;
  if (!res.ok || reply.error) throw new Error(`[kv] ${command[0]} failed: ${reply.error ?? res.status}`);
  return reply.result;
}

// ---------------------------------------------------------------- local

type Entry = { value: string; expiresAt: number | null };

type LocalState = { entries: Map<string, Entry>; fileWritable: boolean; saving: Promise<void> | null; dirty: boolean };

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "kv.json");

// Kept on globalThis so every route bundle in one process shares one map.
const GLOBAL_KEY = Symbol.for("nextrainers.kv.local");

function local(): LocalState {
  const holder = globalThis as unknown as Record<symbol, LocalState | undefined>;
  let state = holder[GLOBAL_KEY];
  if (!state) {
    state = { entries: new Map(), fileWritable: true, saving: null, dirty: false };
    try {
      const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Record<string, Entry>;
      for (const [key, entry] of Object.entries(parsed)) {
        if (entry && typeof entry.value === "string") state.entries.set(key, entry);
      }
    } catch {
      // Missing or corrupt file: start empty (fresh checkout, CI).
    }
    holder[GLOBAL_KEY] = state;
  }
  return state;
}

function liveEntry(key: string): Entry | null {
  const state = local();
  const entry = state.entries.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    state.entries.delete(key);
    return null;
  }
  return entry;
}

// Writes the whole map atomically; single-flight with one queued re-run.
async function saveLocal(): Promise<void> {
  const state = local();
  if (!state.fileWritable) return;
  if (state.saving) {
    state.dirty = true;
    return state.saving;
  }
  state.saving = (async () => {
    try {
      const temp = `${DATA_FILE}.tmp`;
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(temp, JSON.stringify(Object.fromEntries(state.entries)), "utf8");
      await rename(temp, DATA_FILE);
    } catch (error) {
      state.fileWritable = false; // read-only FS: keep serving from memory
      console.error("[kv] local file not writable, using memory only:", error);
    } finally {
      state.saving = null;
    }
  })();
  await state.saving;
  if (state.dirty) {
    state.dirty = false;
    await saveLocal();
  }
}

// ---------------------------------------------------------------- api

export async function kvGet(key: string): Promise<string | null> {
  if (kvIsRemote) {
    const result = await redis(["GET", key]);
    return typeof result === "string" ? result : null;
  }
  return liveEntry(key)?.value ?? null;
}

// Stores `value`; `ttlSeconds` makes the key expire.
export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (kvIsRemote) {
    await redis(ttlSeconds ? ["SET", key, value, "EX", ttlSeconds] : ["SET", key, value]);
    return;
  }
  local().entries.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  await saveLocal();
}

// Sets only when the key is absent; true when this call created it.
export async function kvSetIfAbsent(key: string, value: string): Promise<boolean> {
  if (kvIsRemote) return (await redis(["SET", key, value, "NX"])) === "OK";
  if (liveEntry(key)) return false;
  await kvSet(key, value);
  return true;
}

// Several keys at once (one round trip on Redis).
export async function kvSetMany(pairs: [string, string][]): Promise<void> {
  if (!pairs.length) return;
  if (kvIsRemote) {
    await redis(["MSET", ...pairs.flat()]);
    return;
  }
  for (const [key, value] of pairs) local().entries.set(key, { value, expiresAt: null });
  await saveLocal();
}

export async function kvDel(key: string): Promise<void> {
  if (kvIsRemote) {
    await redis(["DEL", key]);
    return;
  }
  if (local().entries.delete(key)) await saveLocal();
}
