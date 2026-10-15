// Per-account in-memory store. All collections start from the seeds in
// lib/seed.ts and are mutated by the route handlers (favorites, deletes, read
// receipts, ...).
//
// Tenancy: every account gets its own state (deep copy of the seeds on first
// use); requests without a valid session use the shared "demo" tenant, like
// the original app's guest mode. Route handlers are wrapped in withStore()
// (lib/persist.ts), which resolves the tenant from the request and runs the
// handler inside an AsyncLocalStorage scope; the exported `store` below reads
// and writes the current scope's state, so handlers keep using `store.x`.
//
// Persistence (lib/persist.ts, lib/kv.ts): withStore() overlays the tenant's
// seed state with its latest saved snapshot (Upstash Redis in production,
// data/kv.json locally) and saves it back before responding when the handler
// mutated it. Mutations are detected by a tracking proxy — top-level
// assignments, array mutations (push/unshift/splice/...), Set/Map mutations
// and property writes on the store's own objects all mark the tenant dirty.
// Routes that mutate objects pulled out of a list (raw references) call
// persistSoon() explicitly.
import type { GenerationJobRecord } from "./generation";
import { currentTenant, registerCodec, type TenantInit } from "./persist";
import {
  seedAnalyses,
  seedExercises,
  seedNextMatch,
  seedNotifications,
  seedPlayers,
  seedSeasonPlan,
  seedSeasonSessions,
  seedTrainings,
  type SeasonMatch,
} from "./seed";

export { persistSoon, withStore } from "./persist";

// ---------------------------------------------------------------- state

// Seed-backed base state for one tenant (seed dates are relative to "today",
// so a fresh account always looks alive). Seeds are deep-copied so tenants
// never share mutable objects.
function createState(init: TenantInit) {
  return {
    coachCount: 21000,
    club: { id: "club_demo", name: "AS Démo", memberCount: 12, isSupervisor: false },
    profile: {
      id: init.userId ?? "coach-demo",
      fullName: "Coach Demo",
      firstName: "Coach",
      lastName: "Demo",
      email: init.email ?? "coach@example.com",
      imageUrl: null as string | null,
      locale: "fr",
      // Onboarding fields read by the client (contract §8).
      teamName: "AS Démo",
      dateOfBirth: "1990-05-01",
      experience: 5 as number | null,
      level: "intermediate" as string | null,
      ageGroup: "u15",
      trainingDays: ["tuesday", "thursday"],
      onboardingCompletedAt: "2026-08-01T10:00:00.000Z",
    },
    onboarding: { completed: true, step: "done" },
    currency: { currency: "EUR" },
    tactics: {} as Record<string, unknown>,
    dismissals: {} as Record<string, boolean>,
    favorites: new Set<string>(),
    exercises: structuredClone(seedExercises),
    trainings: structuredClone(seedTrainings),
    players: structuredClone(seedPlayers),
    analyses: structuredClone(seedAnalyses),
    seasonPlans: [structuredClone(seedSeasonPlan)],
    seasonSessions: structuredClone(seedSeasonSessions),
    nextMatch: seedNextMatch(),
    notifications: seedNotifications(),
    shareTokens: new Map<string, string>(), // share token -> training id
    // Per-exercise "was this feedback positive?" flags (appendix endpoint).
    exerciseFeedback: {} as Record<string, boolean>,
    // Live-activity tokens pushed by the client (contract §11), bounded to 20.
    liveActivityTokens: [] as string[],
    // Last season-generation job (lib/generation.ts), shared across instances.
    generationJob: null as GenerationJobRecord | null,
    // Imported match calendar (POST /api/season/calendar, quick-import).
    seasonMatches: [] as SeasonMatch[],
    // Exercise ids saved to the club library (appendix endpoint).
    clubLibrary: [] as string[],
    // Last coach-DNA match saved by the client (appendix endpoint).
    coachDnaMatch: null as Record<string, unknown> | null,
  };
}

export type StoreState = ReturnType<typeof createState>;

// ---------------------------------------------------------------- snapshots

// v2: the exercise library grew from 19 to 60 entries; older snapshots get
// the new seed exercises appended (exercises they deleted stay deleted, since
// only ids unknown to the v1 library are added).
const SNAPSHOT_VERSION = 2;
const V1_EXERCISE_IDS = new Set(
  "001 004 005 008 010 011 012 013 016 020 022 023 025 030 037 039 040 048 049".split(" ").map((n) => `ex_${n}`),
);

// Keys restored wholesale from a snapshot. Anything absent is ignored and each
// value passes a shape check, so a truncated or hand-edited snapshot degrades
// to the seeds instead of corrupting the store.
const SNAPSHOT_ARRAY_KEYS = [
  "exercises",
  "trainings",
  "players",
  "analyses",
  "seasonPlans",
  "seasonSessions",
  "notifications",
  "liveActivityTokens",
  "seasonMatches",
  "clubLibrary",
] as const;

const SNAPSHOT_OBJECT_KEYS = [
  "club",
  "profile",
  "onboarding",
  "currency",
  "tactics",
  "dismissals",
  "nextMatch",
  "exerciseFeedback",
] as const;

// Applies a previously saved snapshot over a seed-backed state.
function applySnapshot(state: StoreState, snap: Record<string, unknown>): void {
  const raw = state as unknown as Record<string, unknown>;

  if (typeof snap.coachCount === "number") raw.coachCount = snap.coachCount;
  for (const key of SNAPSHOT_ARRAY_KEYS) {
    if (Array.isArray(snap[key])) raw[key] = snap[key];
  }
  for (const key of SNAPSHOT_OBJECT_KEYS) {
    const value = snap[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) raw[key] = value;
  }
  const job = snap.generationJob as GenerationJobRecord | null | undefined;
  if (job === null || (typeof job === "object" && typeof job?.status === "string")) {
    state.generationJob = job ?? null;
  }
  const dna = snap.coachDnaMatch;
  if (dna === null || (dna && typeof dna === "object" && !Array.isArray(dna))) {
    state.coachDnaMatch = dna as Record<string, unknown> | null;
  }
  if (Array.isArray(snap.favorites)) {
    state.favorites = new Set(snap.favorites.filter((id): id is string => typeof id === "string"));
  }
  if (Array.isArray(snap.shareTokens)) {
    state.shareTokens = new Map(
      snap.shareTokens.filter(
        (pair): pair is [string, string] =>
          Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string",
      ),
    );
  }

  // v1 -> v2: append the library exercises a v1 snapshot never knew about.
  if ((typeof snap.version === "number" ? snap.version : 1) < 2 && Array.isArray(snap.exercises)) {
    const present = new Set(state.exercises.map((e) => e.id));
    const added = seedExercises.filter((e) => !present.has(e.id) && !V1_EXERCISE_IDS.has(e.id));
    state.exercises = [...state.exercises, ...structuredClone(added)].sort((a, b) => a.id.localeCompare(b.id));
  }
}

// Serializes a whole state. Set/Map are expanded to arrays because JSON has
// no such types.
function snapshot(state: StoreState): Record<string, unknown> {
  return {
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    coachCount: state.coachCount,
    club: state.club,
    profile: state.profile,
    onboarding: state.onboarding,
    currency: state.currency,
    tactics: state.tactics,
    dismissals: state.dismissals,
    favorites: [...state.favorites],
    exercises: state.exercises,
    trainings: state.trainings,
    players: state.players,
    analyses: state.analyses,
    seasonPlans: state.seasonPlans,
    seasonSessions: state.seasonSessions,
    nextMatch: state.nextMatch,
    notifications: state.notifications,
    shareTokens: [...state.shareTokens],
    exerciseFeedback: state.exerciseFeedback,
    liveActivityTokens: state.liveActivityTokens,
    generationJob: state.generationJob,
    seasonMatches: state.seasonMatches,
    clubLibrary: state.clubLibrary,
    coachDnaMatch: state.coachDnaMatch,
  };
}


// ------------------------------------------------------------- mutation hooks

// In-place mutating methods we intercept by container type. Everything else
// reads through to the raw value (bound when it is a function), so array
// iteration and Set/Map lookups keep returning the original object identities.
const ARRAY_MUTATORS = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);

function isTrackable(value: unknown): value is object {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value) || value instanceof Set || value instanceof Map) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Returns a tracker for one tenant: wraps arrays, Sets, Maps and plain
// objects so every mutation calls `onMutate`. Wrappers are memoized per
// target, so reading the same value twice returns the same wrapper, and nested
// values are wrapped lazily on read.
function makeTracker(onMutate: () => void): <T>(value: T) => T {
  const wrappers = new WeakMap<object, object>();

  function track<T>(value: T): T {
    if (!isTrackable(value)) return value;
    const target = value as unknown as object;
    const existing = wrappers.get(target);
    if (existing) return existing as T;

    let proxy!: object;
    proxy = new Proxy(target, {
      get(obj, prop) {
        if (typeof prop === "string") {
          if (Array.isArray(obj) && ARRAY_MUTATORS.has(prop)) {
            return (...args: unknown[]) => {
              const result = (
                Array.prototype as unknown as Record<string, (...a: unknown[]) => unknown>
              )[prop].apply(obj, args);
              onMutate();
              return result;
            };
          }
          if (obj instanceof Set && (prop === "add" || prop === "delete" || prop === "clear")) {
            return (...args: unknown[]) => {
              const result = (
                Set.prototype as unknown as Record<string, (...a: unknown[]) => unknown>
              )[prop].apply(obj, args);
              onMutate();
              return prop === "add" ? proxy : result;
            };
          }
          if (obj instanceof Map && (prop === "set" || prop === "delete" || prop === "clear")) {
            return (...args: unknown[]) => {
              const result = (
                Map.prototype as unknown as Record<string, (...a: unknown[]) => unknown>
              )[prop].apply(obj, args);
              onMutate();
              return prop === "set" ? proxy : result;
            };
          }
        }
        const current = Reflect.get(obj, prop, obj);
        if (typeof current === "function") return current.bind(obj);
        return track(current);
      },
      set(obj, prop, newValue) {
        Reflect.set(obj, prop, track(newValue), obj);
        onMutate();
        return true;
      },
      deleteProperty(obj, prop) {
        Reflect.deleteProperty(obj, prop);
        onMutate();
        return true;
      },
    });

    wrappers.set(target, proxy);
    wrappers.set(proxy, proxy);
    return proxy as T;
  }

  return track;
}

// The exported store: the current request's tenant state (tracked). Reads and
// writes are forwarded on every access, so `store.trainings = [...]` replaces
// the tenant's list and marks it dirty.
export const store: StoreState = new Proxy({} as StoreState, {
  get(_target, prop) {
    return Reflect.get(currentTenant().tracked as object, prop);
  },
  set(_target, prop, value) {
    return Reflect.set(currentTenant().tracked as object, prop, value);
  },
  has(_target, prop) {
    return prop in (currentTenant().tracked as object);
  },
  ownKeys() {
    return Reflect.ownKeys(currentTenant().tracked as object);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const descriptor = Reflect.getOwnPropertyDescriptor(currentTenant().tracked as object, prop);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});

// Hooks lib/persist.ts uses to build, restore, track and save tenant states.
registerCodec<StoreState>({ create: createState, apply: applySnapshot, snapshot, makeTracker });
