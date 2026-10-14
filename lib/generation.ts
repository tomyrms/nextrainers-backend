// In-memory generation job manager for POST /api/season/generate (contract §11).
// The real backend generates a season skeleton asynchronously; the clone
// simulates that: starting a job flips its status to "running", the work lands
// ~1.2s later, and the client polls /api/generation/status until it reads
// "done" (then navigates to `path`).
import { store } from "./store";
import type { Exercise, SeasonPlan, SeasonSession, Training } from "./seed";

export type GenerationLocale = "fr" | "en" | "de";

export type GenerationStatus = "running" | "done" | "failed";

export type GenerationJob = {
  seasonPlanId: string;
  locale: GenerationLocale;
  status: GenerationStatus;
  // Where the client should navigate once the job is done (client reads it).
  path?: string;
  startedAt: string;
  // Sessions produced by this run, kept so a regeneration can replace them.
  generated: SeasonSession[];
  // Resolves when the simulated work finishes (success or failure).
  done: Promise<void>;
};

// Simulated generation time. The client polls every 4s, so one tick is enough.
const GENERATION_MS = 1200;

// Fixed ids for the demo trainings a run publishes, so regenerating the
// skeleton replaces them instead of piling up duplicates in the store.
const GENERATED_TRAINING_PREFIX = "tr_gen_";

// Two realistic sessions built from the seeded content library, keyed to the
// seeded plan's themes (pressing / finishing, contract §5 seasonThemesPriority).
type SessionBlueprint = {
  name: string;
  theme: string;
  sessionKind: string | null;
  intensity: SeasonSession["intensity"];
  objective: string;
  exerciseIds: string[];
};

const SESSION_BLUEPRINTS: SessionBlueprint[] = [
  {
    name: "Pressing coordonné et transitions",
    theme: "pressing",
    sessionKind: "development",
    intensity: "medium",
    objective: "Pressing coordonné : fermer le couloir du porteur en bloc",
    exerciseIds: ["ex_030", "ex_025", "ex_020", "ex_037", "ex_008"],
  },
  {
    name: "Finition et transitions offensives",
    theme: "finishing",
    sessionKind: "matchPrep",
    intensity: "high",
    objective: "Finition rapide après récupération dans le dernier tiers",
    exerciseIds: ["ex_001", "ex_013", "ex_040", "ex_010", "ex_049"],
  },
];

// ---------------------------------------------------------------- dates

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseYmd(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// Converts plan.trainingDays ("tuesday") to Date#getUTCDay numbers (2).
function trainingWeekdays(days: string[]): number[] {
  const numbers = days.map((day) => WEEKDAYS.indexOf(day.toLowerCase())).filter((day) => day >= 0);
  return numbers.length ? numbers : [2, 4];
}

// The next `count` training dates, strictly after the latest planned session
// (and never in the past), matching the plan's training days.
function nextTrainingDates(plan: SeasonPlan, count: number): string[] {
  const weekdays = trainingWeekdays(plan.trainingDays);
  const today = ymd(new Date());
  const latest = [today, ...store.seasonSessions.map((s) => s.date)].sort().pop() ?? today;
  const cursor = parseYmd(latest);

  const dates: string[] = [];
  for (let offset = 1; dates.length < count && offset <= 90; offset++) {
    const day = addDays(cursor, offset);
    if (weekdays.includes(day.getUTCDay())) dates.push(ymd(day));
  }
  return dates;
}

// Weeks elapsed since the championship start, 1-based (contract §6 weekIndex).
function weekIndexFor(date: string, plan: SeasonPlan): number {
  const start = parseYmd(plan.calendar?.championshipStartDate ?? date);
  const days = Math.floor((parseYmd(date).getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

// Mesocycle name from the plan's macro-plan block covering that week.
function mesocycleFor(weekIndex: number, plan: SeasonPlan): string {
  const blocks = plan.macroPlan ?? [];
  const block =
    blocks.find((b) => weekIndex >= b.startWeek && weekIndex <= b.endWeek) ?? blocks[blocks.length - 1];
  return block?.name ?? "Bloc 1";
}

// ---------------------------------------------------------------- job state

const jobs = new Map<string, GenerationJob>(); // keyed by seasonPlanId
let current: GenerationJob | null = null; // last job started (single-user clone)

// Live-activity tokens pushed by the client (contract §11). The clone only
// stores them; a real generator would use them to report progress.
const liveActivityTokens = new Set<string>();

export function getCurrentJob(): GenerationJob | null {
  return current;
}

export function storeLiveActivityToken(token: string): void {
  liveActivityTokens.add(token);
  // Keep the demo set bounded (oldest out first).
  if (liveActivityTokens.size > 20) {
    const oldest = liveActivityTokens.values().next().value;
    if (oldest !== undefined) liveActivityTokens.delete(oldest);
  }
}

// ---------------------------------------------------------------- generation

// Builds one stored Training (contract §3) from a blueprint, reusing the
// seeded exercise library so GET /api/trainings reflects the new sessions.
function buildTraining(blueprint: SessionBlueprint, date: string, plan: SeasonPlan, index: number): Training {
  const exercises = blueprint.exerciseIds
    .map((id) => store.exercises.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));

  return {
    id: `${GENERATED_TRAINING_PREFIX}${index + 1}`,
    name: blueprint.name,
    theme: blueprint.theme,
    date,
    duration: exercises.reduce((total, exercise) => total + exercise.duration, 0),
    ageGroup: plan.teamCategory.toUpperCase(),
    playerCount: 16,
    plan: exercises,
    exercises: exercises.map((e) => ({ id: e.id, exerciseSvg: e.exerciseSvg, setupSvg: e.setupSvg })),
    manually_created: false,
    createdAt: new Date().toISOString(),
  };
}

// The simulated work: session skeleton + matching trainings into the store.
function runGeneration(job: GenerationJob): void {
  const plan = store.seasonPlans.find((p) => p.id === job.seasonPlanId);
  if (!plan) throw new Error(`unknown season plan: ${job.seasonPlanId}`);

  const dates = nextTrainingDates(plan, SESSION_BLUEPRINTS.length);
  const trainings = SESSION_BLUEPRINTS.map((blueprint, index) =>
    buildTraining(blueprint, dates[index] ?? ymd(new Date()), plan, index),
  );

  // Replace trainings from a previous run so the demo store stays bounded.
  store.trainings = [
    ...trainings,
    ...store.trainings.filter((training) => !training.id.startsWith(GENERATED_TRAINING_PREFIX)),
  ];

  const sessions: SeasonSession[] = SESSION_BLUEPRINTS.map((blueprint, index) => {
    const training = trainings[index];
    const weekIndex = weekIndexFor(training.date, plan);
    return {
      date: training.date,
      weekIndex,
      theme: blueprint.theme,
      mesocycle: mesocycleFor(weekIndex, plan),
      intensity: blueprint.intensity,
      sessionKind: blueprint.sessionKind,
      durationMinutes: training.duration,
      objective: blueprint.objective,
      trainingSessionId: training.id,
      status: "planned",
      hasFeedback: false,
    };
  });

  job.generated = sessions;
  store.seasonSessions = [...store.seasonSessions, ...sessions];
}

// Starts (or restarts) the job for a season plan and returns it immediately;
// callers await `job.done` when they want the finished result.
export function startGeneration(seasonPlanId: string, locale: GenerationLocale): GenerationJob {
  const previous = jobs.get(seasonPlanId);

  let finish!: () => void;
  const job: GenerationJob = {
    seasonPlanId,
    locale,
    status: "running",
    startedAt: new Date().toISOString(),
    generated: [],
    done: new Promise<void>((resolve) => {
      finish = resolve;
    }),
  };
  jobs.set(seasonPlanId, job);
  current = job;

  // Regeneration: drop the sessions the previous run for this plan appended.
  if (previous?.generated.length) {
    const stale = new Set(previous.generated);
    store.seasonSessions = store.seasonSessions.filter((session) => !stale.has(session));
  }

  setTimeout(() => {
    try {
      runGeneration(job);
      job.status = "done";
      job.path = "/fr/saison";
    } catch {
      job.status = "failed";
    } finally {
      finish();
    }
  }, GENERATION_MS);

  return job;
}
