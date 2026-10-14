// JSON-file persistence for the in-memory store (lib/store.ts).
//
// store.ts registers a snapshot provider at module init and calls persistSoon()
// on every mutation. Saves are debounced (300 ms), single-flight and
// fire-and-forget, so request handlers never block on disk I/O. All failures
// are logged once and swallowed: a missing/corrupt file falls back to the
// seeds (CI starts with no file at all) and a failed save never crashes a
// request. The file is replaced atomically so a reader never sees partial JSON.
import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const TEMP_FILE = `${DATA_FILE}.tmp`;
const DEBOUNCE_MS = 300;

export type Snapshot = Record<string, unknown>;

let snapshotProvider: (() => Snapshot) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let saveInFlight = false;
let dirtyDuringSave = false;
let ioErrorLogged = false;

// Log the first I/O failure, then stay quiet so a broken disk cannot flood logs.
function logIoError(phase: string, error: unknown): void {
  if (ioErrorLogged) return;
  ioErrorLogged = true;
  console.error(`[persist] ${phase} failed (further persist errors muted):`, error);
}

// store.ts hands over a serializer for the current state; called on every save.
export function registerSnapshot(provider: () => Snapshot): void {
  snapshotProvider = provider;
}

// The last saved snapshot, or null when missing/corrupt. Called once from
// store.ts module init, so a small synchronous read is acceptable.
export function loadSnapshot(): Snapshot | null {
  let text: string;
  try {
    text = readFileSync(DATA_FILE, "utf8");
  } catch (error) {
    // ENOENT is the normal fresh-start case (first run, CI): use the seeds.
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") logIoError("load", error);
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Snapshot;
  } catch (error) {
    logIoError("parse", error);
    return null;
  }
}

// Schedules an asynchronous save, coalescing bursts of mutations.
export function persistSoon(): void {
  if (!snapshotProvider) return;
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void save();
  }, DEBOUNCE_MS);
}

async function save(): Promise<void> {
  if (!snapshotProvider) return;
  if (saveInFlight) {
    // A write is already running: queue one more pass with the latest state.
    dirtyDuringSave = true;
    return;
  }

  saveInFlight = true;
  try {
    const json = JSON.stringify(snapshotProvider(), null, 2);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(TEMP_FILE, json, "utf8");
    await rename(TEMP_FILE, DATA_FILE); // atomic replace
  } catch (error) {
    logIoError("save", error);
  } finally {
    saveInFlight = false;
    if (dirtyDuringSave) {
      dirtyDuringSave = false;
      persistSoon();
    }
  }
}
