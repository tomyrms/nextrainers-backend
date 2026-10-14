// In-memory demo store. Swap for a real database when you grow the clone.
// All collections start from the seeds in lib/seed.ts and can be mutated by
// the route handlers (favorites, deletes, read receipts, ...).
//
// Persistence (lib/persist.ts, lib/kv.ts): route handlers wrapped in
// withStore() overlay the seed state with the latest saved snapshot (Upstash
// Redis in production, data/kv.json locally; a fresh store uses the seeds as
// is) and save it back before responding when they mutated it. Mutations are detected by wrapping the store in a
// tracking proxy — top-level assignments (including lib/generation.ts's),
// array mutations (push/unshift/splice/...), Set/Map mutations and property
// writes on the store's own objects all call persistSoon(). Wrappers are
// memoized per target, so values keep a stable identity across reads. Routes
// that mutate objects pulled out of a list (e.g. one notification) call
// persistSoon() explicitly since those are raw references.
import type { GenerationJobRecord } from "./generation";
import { persistSoon, registerApplier, registerSnapshot } from "./persist";
import {
  seedAnalyses,
  seedExercises,
  seedNextMatch,
  seedNotifications,
  seedPlayers,
  seedSeasonPlan,
  seedSeasonSessions,
  seedTrainings,
} from "./seed";

export { persistSoon, withStore } from "./persist";

// ---------------------------------------------------------------- state

// Seed-backed base state (seed dates are relative to "today", so a fresh
// start always looks alive). Everything below is mutable at runtime.
const state = {
  coachCount: 21000,
  club: { id: "club_demo", name: "AS Démo", memberCount: 12, isSupervisor: false },
  profile: {
    id: "coach-demo",
    fullName: "Coach Demo",
    firstName: "Coach",
    lastName: "Demo",
    email: "coach@example.com",
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
  exercises: [...seedExercises],
  trainings: [...seedTrainings],
  players: [...seedPlayers],
  analyses: [...seedAnalyses],
  seasonPlans: [seedSeasonPlan],
  seasonSessions: [...seedSeasonSessions],
  nextMatch: seedNextMatch(),
  notifications: [...seedNotifications()],
  shareTokens: new Map<string, string>(), // share token -> training id
  // Per-exercise "was this feedback positive?" flags (appendix endpoint).
  exerciseFeedback: {} as Record<string, boolean>,
  // Live-activity tokens pushed by the client (contract §11), bounded to 20.
  liveActivityTokens: [] as string[],
  // Last season-generation job (lib/generation.ts), shared across instances.
  generationJob: null as GenerationJobRecord | null,
};

export type StoreState = typeof state;

// ---------------------------------------------------------------- persistence

const SNAPSHOT_VERSION = 1;

// Keys restored wholesale from a saved file. Anything absent is ignored, each
// value passes a shape check, so a truncated or hand-edited file degrades to
// the seeds instead of corrupting the store.
const SNAPSHOT_ARRAY_KEYS = [
  "exercises",
  "trainings",
  "players",
  "analyses",
  "seasonPlans",
  "seasonSessions",
  "notifications",
  "liveActivityTokens",
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

// Applies a previously saved snapshot over the seed-backed state.
function applySnapshot(snap: Record<string, unknown>): void {
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
}

registerApplier(applySnapshot);

// Serializes the whole state. Set/Map are expanded to arrays because JSON has
// no such types.
function snapshot(): Record<string, unknown> {
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
  };
}

registerSnapshot(snapshot);

// ------------------------------------------------------------- mutation hooks

// In-place mutating methods we intercept by container type. Everything else
// reads through to the raw value (bound when it is a function), so array
// iteration and Set/Map lookups keep returning the original object identities
// (lib/generation.ts compares stored session objects against a Set).
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

const wrappers = new WeakMap<object, object>();

function isTrackable(value: unknown): value is object {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value) || value instanceof Set || value instanceof Map) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Wraps arrays, Sets, Maps and plain objects so every mutation schedules a
// save. Wrappers are memoized per target: reading the same value twice returns
// the same wrapper, and nested values are wrapped lazily on read.
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
            persistSoon();
            return result;
          };
        }
        if (obj instanceof Set && (prop === "add" || prop === "delete" || prop === "clear")) {
          return (...args: unknown[]) => {
            const result = (
              Set.prototype as unknown as Record<string, (...a: unknown[]) => unknown>
            )[prop].apply(obj, args);
            persistSoon();
            return prop === "add" ? proxy : result;
          };
        }
        if (obj instanceof Map && (prop === "set" || prop === "delete" || prop === "clear")) {
          return (...args: unknown[]) => {
            const result = (
              Map.prototype as unknown as Record<string, (...a: unknown[]) => unknown>
            )[prop].apply(obj, args);
            persistSoon();
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
      persistSoon();
      return true;
    },
    deleteProperty(obj, prop) {
      Reflect.deleteProperty(obj, prop);
      persistSoon();
      return true;
    },
  });

  wrappers.set(target, proxy);
  wrappers.set(proxy, proxy);
  return proxy as T;
}

// The exported store: same data, every mutation hooked into persistence.
export const store: StoreState = track(state);
