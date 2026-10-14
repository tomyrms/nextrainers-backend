import { randomBytes } from "node:crypto";
import { json, readJson } from "@/lib/http";

// POST /api/exercises/share body { exerciseId } -> { shareUrl } (contract §2).
// Demo implementation: the "share" URL is stable enough for the client's
// clipboard flow without persisting anything server-side.
export async function POST(req: Request) {
  const body = await readJson<{ exerciseId?: string }>(req);
  const token = randomBytes(8).toString("hex");
  const id = body?.exerciseId ?? "unknown";
  return json({ shareUrl: `https://nextrainers.app/exercises/share/${id}?token=${token}` });
}
