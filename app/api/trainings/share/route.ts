import { randomBytes } from "node:crypto";
import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// POST /api/trainings/share body { trainingId } -> { shareUrl } (contract §3).
// The token is stored so GET /api/trainings/share/:token works right away.
async function handlePOST(req: Request) {
  const body = await readJson<{ trainingId?: string }>(req);
  const token = randomBytes(8).toString("hex");
  if (body?.trainingId) store.shareTokens.set(token, body.trainingId);
  return json({ shareUrl: `https://nextrainers.app/trainings/share/${token}` });
}

export const POST = withStore(handlePOST);
