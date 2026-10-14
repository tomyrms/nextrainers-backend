import { json } from "@/lib/http";
import { withStore } from "@/lib/store";
import { nextMatch } from "@/lib/season";

// GET /api/season/next-match?from=YYYY-MM-DD -> { match | null } (contract §1).
// The client only reads match.date/opponent/homeAway/competition. The first
// imported fixture on/after `from` wins; without an imported calendar the
// seeded demo match shows until its date falls before the requested window.
async function handleGET(req: Request) {
  return json({ match: nextMatch(new URL(req.url).searchParams.get("from")) });
}

export const GET = withStore(handleGET);
