import { json, readJson } from "@/lib/http";
import { storeLiveActivityToken } from "@/lib/generation";

// POST /api/generation/live-activity-token body { token } -> any 2xx
// (contract §11: the client ignores the response body).
export async function POST(req: Request) {
  const body = await readJson<{ token?: string }>(req);
  if (typeof body?.token === "string" && body.token) storeLiveActivityToken(body.token);
  return json({ ok: true });
}
