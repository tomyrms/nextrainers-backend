import { connection } from "next/server";
import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";
import type { Training } from "@/lib/seed";

// GET /api/trainings -> TOP-LEVEL array of sessions (contract §3).
// The list is mutable (delete/duplicate), so always render per request.
async function handleGET() {
  await connection();
  return json(store.trainings);
}

// DELETE /api/trainings?id=<id> (query param, not path!) -> response unused.
async function handleDELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) store.trainings = store.trainings.filter((training) => training.id !== id);
  return json({ ok: true });
}

// POST /api/trainings (create) is not exercised by the captured client; kept
// as a small demo helper with contract-shaped defaults.
async function handlePOST(req: Request) {
  const body = await readJson<Partial<Training>>(req);
  const training: Training = {
    id: `sess_${Date.now()}`,
    name: body?.name ?? "Séance",
    theme: body?.theme ?? "technique",
    date: body?.date ?? new Date().toISOString().slice(0, 10),
    duration: body?.duration ?? 75,
    ageGroup: body?.ageGroup ?? "U15",
    playerCount: body?.playerCount ?? 16,
    plan: body?.plan ?? [],
    exercises: body?.exercises ?? [],
    manually_created: true,
    createdAt: new Date().toISOString(),
  };
  store.trainings.unshift(training);
  return json(training);
}

export const GET = withStore(handleGET);
export const DELETE = withStore(handleDELETE);
export const POST = withStore(handlePOST);
