// Subscription service — the clone's source of truth for premium.
//
// Contract recovered from the shipped client (chunk 298, SubscriptionProvider):
//   GET /api/subscription/info ->
//     { isActive, status, currentPeriodEnd?, cancelAtPeriodEnd,
//       trainingsUsedThisMonth, trainingsRemainingThisMonth, canGenerateTraining }
//
// In this clone there is no billing: everyone is premium by definition.
// Set SUBSCRIPTION_MODE=free to simulate the free tier instead.
export type SubscriptionInfo = {
  isActive: boolean;
  status: "active" | "inactive" | "trialing";
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  trainingsUsedThisMonth: number;
  trainingsRemainingThisMonth: number;
  canGenerateTraining: boolean;
};

const FREE_INFO: SubscriptionInfo = {
  isActive: false,
  status: "inactive",
  cancelAtPeriodEnd: false,
  trainingsUsedThisMonth: 0,
  trainingsRemainingThisMonth: 0,
  canGenerateTraining: false,
};

export function getSubscriptionInfo(): SubscriptionInfo {
  if (process.env.SUBSCRIPTION_MODE === "free") return FREE_INFO;
  return {
    isActive: true,
    status: "active",
    currentPeriodEnd: "2099-12-31T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    trainingsUsedThisMonth: 0,
    trainingsRemainingThisMonth: 999999,
    canGenerateTraining: true,
  };
}
