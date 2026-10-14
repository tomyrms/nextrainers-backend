import { connection } from "next/server";
import { json, readJson } from "@/lib/http";
import { persistSoon, store } from "@/lib/store";
import { applySkillUpdates } from "@/lib/skills";
import type { PlayerSkill } from "@/lib/seed";

// GET /api/players/public/:id/skills -> { player, skills, coachOverlaySkills }
// (contract §4); 404 for unknown ids.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  const player = store.players.find((entry) => entry.id === id);
  if (!player) return json({ error: "not_found" }, { status: 404 });
  return json({ player, skills: player.skills, coachOverlaySkills: [] });
}

// PATCH /api/players/public/:id/skills body { skills: [{ id, value }] } ->
// same wrapper with the merged skill values.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const player = store.players.find((entry) => entry.id === id);
  if (!player) return json({ error: "not_found" }, { status: 404 });

  const body = await readJson<{ skills?: Partial<PlayerSkill>[] }>(req);
  if (Array.isArray(body?.skills)) {
    applySkillUpdates(player, body.skills);
    persistSoon();
  }
  return json({ player, skills: player.skills, coachOverlaySkills: [] });
}
