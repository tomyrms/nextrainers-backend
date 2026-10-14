import { connection } from "next/server";
import { json, readJson } from "@/lib/http";
import { store } from "@/lib/store";
import type { SeasonPlan } from "@/lib/seed";

// GET /api/season-plan -> { plan, categories, prefill } (contract §5).
// The plan is mutable (PUT below), so always render per request.
export async function GET() {
  await connection();
  const plan = store.seasonPlans[0] ?? null;
  return json({
    plan,
    categories: [{ teamCategory: "u15" }, { teamCategory: "senior" }],
    prefill: { teamCategory: plan?.teamCategory ?? "u15" },
  });
}

// PUT /api/season-plan (create or update; there is NO POST) body = plan object
// -> { plan } with an assigned id (contract §5).
export async function PUT(req: Request) {
  const body = await readJson<Partial<SeasonPlan>>(req);
  if (!body) return json({ error: "invalid_body" }, { status: 400 });
  const plan = { ...body, id: body.id ?? store.seasonPlans[0]?.id ?? "plan_1" } as SeasonPlan;
  store.seasonPlans = [plan];
  return json({ plan });
}
