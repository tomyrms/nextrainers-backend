import { connection } from "next/server";
import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";
import { newPlayer } from "@/lib/players";
import type { Player } from "@/lib/seed";

// GET /api/players -> TOP-LEVEL array of players (contract §4).
// The roster is mutable (create below), so always render per request.
async function handleGET() {
  await connection();
  return json(store.players);
}

// POST /api/players -> returns the created player (contract §4). Fields not
// provided fall back to contract-shaped demo defaults.
async function handlePOST(req: Request) {
  const player = newPlayer(await readJson<Partial<Player>>(req));
  store.players.push(player);
  return json(player);
}

export const GET = withStore(handleGET);
export const POST = withStore(handlePOST);
