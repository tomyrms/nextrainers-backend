import { randomBytes } from "node:crypto";
import { json, readJson } from "@/lib/http";
import { kvSet } from "@/lib/kv";
import { store, withStore } from "@/lib/store";

// Shared links outlive edits for a while, then expire.
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90;

// POST /api/trainings/share body { trainingId } -> { shareUrl } (contract §3).
// Store data is per account, but a share link must open for anyone, so a
// public copy of the training (+ sharer) is written under share:<token>; the
// token is also kept in the sharer's store.
async function handlePOST(req: Request) {
  const body = await readJson<{ trainingId?: string }>(req);
  const training = body?.trainingId ? store.trainings.find((t) => t.id === body.trainingId) : undefined;
  if (!training) return json({ error: "not_found" }, { status: 404 });

  const token = randomBytes(8).toString("hex");
  store.shareTokens.set(token, training.id);
  const sharedBy = { fullName: store.profile.fullName, teamName: store.profile.teamName };
  await kvSet(`share:${token}`, JSON.stringify({ training, sharedBy }), SHARE_TTL_SECONDS);
  return json({ shareUrl: `https://nextrainers.app/trainings/share/${token}` });
}

export const POST = withStore(handlePOST);
