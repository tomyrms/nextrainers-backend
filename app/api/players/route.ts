import { connection } from "next/server";
import { json, readJson } from "@/lib/http";
import { store } from "@/lib/store";
import type { Player } from "@/lib/seed";

// GET /api/players -> TOP-LEVEL array of players (contract §4).
// The roster is mutable (create below), so always render per request.
export async function GET() {
  await connection();
  return json(store.players);
}

// POST /api/players -> returns the created player (contract §4). Fields not
// provided fall back to contract-shaped demo defaults.
export async function POST(req: Request) {
  const body = await readJson<Partial<Player>>(req);
  const player: Player = {
    id: `pl_${Date.now()}`,
    firstName: body?.firstName ?? "Nouveau",
    lastName: body?.lastName ?? "Joueur",
    nickname: null,
    position: body?.position ?? "MC",
    jerseyNumber: body?.jerseyNumber ?? 0,
    preferredFoot: body?.preferredFoot ?? "RIGHT",
    dateOfBirth: body?.dateOfBirth ?? "2011-01-01",
    coachNotes: body?.coachNotes ?? "",
    matches: body?.matches ?? 0,
    goals: body?.goals ?? 0,
    assists: body?.assists ?? 0,
    skills: body?.skills ?? [],
    playerSkills: body?.playerSkills ?? [],
    assistantSkills: body?.assistantSkills ?? [],
    assistantSkillOverlays: body?.assistantSkillOverlays ?? [],
    strengths: body?.strengths ?? [],
    improvements: body?.improvements ?? [],
    teamContext: { mode: "coach" },
  };
  store.players.push(player);
  return json(player);
}
