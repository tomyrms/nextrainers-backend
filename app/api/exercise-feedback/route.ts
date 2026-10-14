import { connection } from "next/server";
import { json, readJson } from "@/lib/http";
import { persistSoon, store } from "@/lib/store";

// /api/exercise-feedback (appendix endpoint):
//   GET    ?exerciseId=...            -> { isPositive }
//   POST   { exerciseId, isPositive } -> { ok: true }
//   DELETE ?exerciseId=...            -> { ok: true }
export async function GET(req: Request) {
  await connection();
  const exerciseId = new URL(req.url).searchParams.get("exerciseId");
  return json({ isPositive: exerciseId ? store.exerciseFeedback[exerciseId] === true : false });
}

export async function POST(req: Request) {
  const body = await readJson<{ exerciseId?: string; isPositive?: boolean }>(req);
  if (body?.exerciseId) {
    store.exerciseFeedback[body.exerciseId] = body.isPositive === true;
    persistSoon();
  }
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const exerciseId = new URL(req.url).searchParams.get("exerciseId");
  if (exerciseId) {
    delete store.exerciseFeedback[exerciseId];
    persistSoon();
  }
  return json({ ok: true });
}
