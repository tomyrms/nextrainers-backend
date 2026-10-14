import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// GET /api/season/next-match?from=YYYY-MM-DD -> { match | null } (contract §1).
// The client only reads match.date/opponent/homeAway/competition. The seeded
// match is hidden once its date falls before the requested window.
async function handleGET(req: Request) {
  const from = new URL(req.url).searchParams.get("from");
  const visible = from && store.nextMatch.date < from ? null : store.nextMatch;
  return json({ match: visible });
}

export const GET = withStore(handleGET);
