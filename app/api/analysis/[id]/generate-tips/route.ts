import { json } from "@/lib/http";

// POST /api/analysis/:id/generate-tips -> { ok: true } (contract §7: the
// client fires and forgets, the response body is never read).
export function POST() {
  return json({ ok: true });
}
