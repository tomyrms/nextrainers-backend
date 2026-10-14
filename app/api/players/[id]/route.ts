import { connection } from "next/server";
import { json, readJson } from "@/lib/http";
import { persistSoon, store, withStore } from "@/lib/store";
import { applySkillUpdates } from "@/lib/skills";
import type { Player } from "@/lib/seed";

// Partial-update fields accepted by PATCH (contract §4). `skills` is handled
// separately because it answers with the skill wrapper.
const PATCH_FIELDS = ["coachNotes", "strengths", "improvements", "matches", "goals", "assists"] as const;

// GET /api/players/:id -> the player (not exercised by the recovered client,
// but keeps the detail URL useful); 404 for unknown ids.
async function handleGET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  const player = store.players.find((entry) => entry.id === id);
  if (!player) return json({ error: "not_found" }, { status: 404 });
  return json(player);
}

// PUT /api/players/:id -> full update; returns the updated player (contract §4).
async function handlePUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const player = store.players.find((entry) => entry.id === id);
  if (!player) return json({ error: "not_found" }, { status: 404 });

  const body = await readJson<Partial<Player>>(req);
  if (!body) return json({ error: "invalid_body" }, { status: 400 });

  Object.assign(player, body, { id: player.id });
  persistSoon();
  return json(player);
}

// PATCH /api/players/:id -> partial update (contract §4):
//   body { skills: [{ id, value }] } -> { skills, playerSkills, assistantSkills,
//   assistantSkillOverlays }; any of coachNotes | strengths | improvements |
//   matches | goals | assists -> the updated player object.
async function handlePATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const player = store.players.find((entry) => entry.id === id);
  if (!player) return json({ error: "not_found" }, { status: 404 });

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return json({ error: "invalid_body" }, { status: 400 });

  if (Array.isArray(body.skills)) {
    applySkillUpdates(player, body.skills);
    persistSoon();
    return json({
      skills: player.skills,
      playerSkills: player.playerSkills,
      assistantSkills: player.assistantSkills,
      assistantSkillOverlays: player.assistantSkillOverlays,
    });
  }

  const raw = player as unknown as Record<string, unknown>;
  for (const key of PATCH_FIELDS) {
    if (body[key] !== undefined) raw[key] = body[key];
  }
  persistSoon();
  return json(player);
}

// DELETE /api/players/:id -> removes the player from the in-memory roster
// (contract §4). 404 when the id is unknown so the client can surface it.
async function handleDELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const index = store.players.findIndex((player) => player.id === id);
  if (index === -1) {
    return json({ error: "player_not_found" }, { status: 404 });
  }
  store.players.splice(index, 1);
  persistSoon();
  return json({});
}

export const GET = withStore(handleGET);
export const PUT = withStore(handlePUT);
export const PATCH = withStore(handlePATCH);
export const DELETE = withStore(handleDELETE);
