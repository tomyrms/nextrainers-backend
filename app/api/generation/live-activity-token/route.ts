import { json, readJson } from "@/lib/http";
import { withStore } from "@/lib/store";
import { storeLiveActivityToken } from "@/lib/generation";

// POST /api/generation/live-activity-token body { token } -> any 2xx
// (contract §11: the client ignores the response body). The token is kept in
// the persistent store (bounded to 20, oldest out first, no duplicates).
async function handlePOST(req: Request) {
  const body = await readJson<{ token?: string }>(req);
  if (typeof body?.token === "string" && body.token) storeLiveActivityToken(body.token);
  return json({ ok: true });
}

export const POST = withStore(handlePOST);
