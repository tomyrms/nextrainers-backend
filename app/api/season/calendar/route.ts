import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";
import { matchesFor, normalizeMatches, saveMatches } from "@/lib/season";

// GET /api/season/calendar?seasonPlanId= -> { matches } (contract §6: no
// consumer captured, `matches` is the safe inference; `events` kept for the
// earlier stub shape).
async function handleGET(req: Request) {
  const seasonPlanId = new URL(req.url).searchParams.get("seasonPlanId");
  return json({ events: [], matches: matchesFor(seasonPlanId || null) });
}

type Body = { seasonPlanId?: unknown; matches?: unknown; replace?: unknown };

// POST /api/season/calendar body { seasonPlanId, matches:[{date, opponent,
// homeAway, competition, source}], replace } -> { inserted } (contract §6).
async function handlePOST(req: Request) {
  const body = await readJson<Body>(req);
  const seasonPlanId = typeof body?.seasonPlanId === "string" ? body.seasonPlanId : "";
  if (!store.seasonPlans.some((plan) => plan.id === seasonPlanId)) {
    return json({ error: "unknown_season_plan" }, { status: 404 });
  }
  if (!Array.isArray(body?.matches)) return json({ error: "matches must be an array" }, { status: 400 });

  const inserted = saveMatches(seasonPlanId, normalizeMatches(body.matches, seasonPlanId), body.replace === true);
  return json({ inserted });
}

export const GET = withStore(handleGET);
export const POST = withStore(handlePOST);
