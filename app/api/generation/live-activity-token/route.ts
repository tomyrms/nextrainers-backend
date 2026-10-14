import { json, readJson } from "@/lib/http";
import { persistSoon, store } from "@/lib/store";
import { storeLiveActivityToken } from "@/lib/generation";

// POST /api/generation/live-activity-token body { token } -> any 2xx
// (contract §11: the client ignores the response body). The token is mirrored
// into the persistent store (bounded to 20, oldest out first) on top of the
// generation module's in-memory set.
export async function POST(req: Request) {
  const body = await readJson<{ token?: string }>(req);
  if (typeof body?.token === "string" && body.token) {
    storeLiveActivityToken(body.token);

    store.liveActivityTokens.push(body.token);
    if (store.liveActivityTokens.length > 20) {
      store.liveActivityTokens.splice(0, store.liveActivityTokens.length - 20);
    }
    persistSoon();
  }
  return json({ ok: true });
}
