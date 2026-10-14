// In-memory demo store. Swap for a real database when you grow the clone.
export const store = {
  coachCount: 21000,
  profile: {
    id: "coach-demo",
    fullName: "Coach Demo",
    firstName: "Coach",
    lastName: "Demo",
    email: "coach@example.com",
    imageUrl: null as string | null,
    locale: "fr",
  },
  onboarding: { completed: true, step: "done" },
  currency: { currency: "EUR" },
  tactics: {} as Record<string, unknown>,
  dismissals: {} as Record<string, boolean>,
  favorites: new Set<string>(),
  trainings: [] as unknown[],
  exercises: [] as unknown[],
  players: [] as unknown[],
  analyses: [] as unknown[],
  seasonPlans: [] as unknown[],
};
