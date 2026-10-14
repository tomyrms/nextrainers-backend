import { json } from "@/lib/http";
import { store } from "@/lib/store";

// GET /api/season/sessions?seasonPlanId=<id> -> { sessions } (contract §6).
// The demo sessions belong to the seeded plan (plan_1); any other plan id
// yields an empty list so the client shows its "no sessions" state.
export async function GET(req: Request) {
  const seasonPlanId = new URL(req.url).searchParams.get("seasonPlanId");
  const currentPlanId = store.seasonPlans[0]?.id;
  const known = !seasonPlanId || seasonPlanId === currentPlanId;
  return json({ sessions: known ? store.seasonSessions : [] });
}
