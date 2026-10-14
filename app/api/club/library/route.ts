import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// GET /api/club/library -> { exercises, userContext, hasClubAccess } (appendix
// endpoint). The demo coach has no club (hasClubAccess false, so the client
// hides the tab), but the library itself works: POST/DELETE { exerciseId }
// add/remove exercises and GET returns them in the exercise item shape.
async function handleGET() {
  const exercises = store.clubLibrary
    .map((id) => store.exercises.find((exercise) => exercise.id === id))
    .filter((exercise) => exercise !== undefined);
  return json({ exercises, userContext: { canManageLibrary: false }, hasClubAccess: false });
}

async function exerciseIdFrom(req: Request): Promise<string | null> {
  const body = await readJson<{ exerciseId?: unknown }>(req);
  const id = typeof body?.exerciseId === "string" ? body.exerciseId : new URL(req.url).searchParams.get("exerciseId");
  return id || null;
}

async function handlePOST(req: Request) {
  const id = await exerciseIdFrom(req);
  if (!id || !store.exercises.some((exercise) => exercise.id === id)) {
    return json({ error: "unknown_exercise" }, { status: 404 });
  }
  if (!store.clubLibrary.includes(id)) store.clubLibrary.push(id);
  return json({ ok: true });
}

async function handleDELETE(req: Request) {
  const id = await exerciseIdFrom(req);
  if (id) store.clubLibrary = store.clubLibrary.filter((entry) => entry !== id);
  return json({ ok: true });
}

export const GET = withStore(handleGET);
export const POST = withStore(handlePOST);
export const DELETE = withStore(handleDELETE);
