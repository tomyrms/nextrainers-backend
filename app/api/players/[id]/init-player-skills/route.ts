import { json } from "@/lib/http";

// POST /api/players/:id/init-player-skills -> { ok: true } (contract §4: the
// client only checks the request succeeded).
export function POST() {
  return json({ ok: true });
}
