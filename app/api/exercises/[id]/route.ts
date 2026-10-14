import { connection } from "next/server";
import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// DELETE /api/exercises/:id -> response unused (any 2xx). Also drops the item
// from the favorites list so the library stays consistent.
async function handleDELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  store.exercises = store.exercises.filter((exercise) => exercise.id !== id);
  store.favorites.delete(id);
  return json({ ok: true });
}

export const DELETE = withStore(handleDELETE);
