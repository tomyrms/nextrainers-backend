import { json, readJson } from "@/lib/http";
import { withStore } from "@/lib/store";
import { normalizeMatches, planForCategory, saveMatches } from "@/lib/season";

type Body = { teamCategory?: unknown; matches?: unknown };

// POST /api/season/quick-import body { teamCategory, matches } -> { plan }
// (contract §6). Finds or creates the category's plan and replaces its match
// calendar; 400 NO_DATED_MATCHES when no entry carries a valid date.
async function handlePOST(req: Request) {
  const body = await readJson<Body>(req);
  const teamCategory = typeof body?.teamCategory === "string" && body.teamCategory ? body.teamCategory : "senior";

  const dated = normalizeMatches(body?.matches, "");
  if (!dated.length) {
    return json({ error: "No dated matches to import", code: "NO_DATED_MATCHES" }, { status: 400 });
  }

  const plan = planForCategory(teamCategory, dated);
  const inserted = saveMatches(plan.id, dated.map((m) => ({ ...m, seasonPlanId: plan.id, source: m.source || "import" })), true);
  return json({ plan, inserted });
}

export const POST = withStore(handlePOST);
