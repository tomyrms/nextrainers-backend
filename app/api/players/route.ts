import { json, readJson } from "@/lib/http";
import { store } from "@/lib/store";

export function GET() {
  return json({ players: store.players });
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const player = { id: `p_${Date.now()}`, ...(body ?? {}) };
  store.players.push(player);
  return json(player);
}
