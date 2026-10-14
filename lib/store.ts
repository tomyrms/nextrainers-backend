// In-memory demo store. Swap for a real database when you grow the clone.
// All collections start from the seeds in lib/seed.ts and can be mutated by
// the route handlers (favorites, deletes, read receipts, ...).
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

export const store = {
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
};
