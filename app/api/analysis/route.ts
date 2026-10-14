import { connection } from "next/server";
import { json, readJson } from "@/lib/http";
import { store } from "@/lib/store";
import type { Analysis } from "@/lib/seed";

// GET /api/analysis -> TOP-LEVEL array (contract §7). The card reads `id`,
// `teamFormation`, `opponentTeamName`, `opponentTeamFormation`.
export async function GET() {
  await connection();
  return json(store.analyses);
}

// POST /api/analysis body { teamFormation, opponentTeamFormation, opponentTeamName }
// -> { id } (contract §7).
export async function POST(req: Request) {
  const body = await readJson<Partial<Analysis>>(req);
  const analysis: Analysis = {
    id: `an_${Date.now()}`,
    teamFormation: body?.teamFormation ?? "4-3-3",
    opponentTeamName: body?.opponentTeamName ?? "Adversaire",
    opponentTeamFormation: body?.opponentTeamFormation ?? "4-4-2",
  };
  store.analyses.unshift(analysis);
  return json({ id: analysis.id });
}
