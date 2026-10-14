import { connection } from "next/server";
import { json } from "@/lib/http";
import { store } from "@/lib/store";

// Client contract (chunk 3910), per docs/api-contract.md §2:
//   GET /api/exercises/favorite -> TOP-LEVEL array of favorited exercise items
//   POST /api/exercises/favorite body { exerciseId } -> any 2xx
//   DELETE /api/exercises/favorite?exerciseId=... -> any 2xx
export async function GET() {
  await connection(); // favorites change at runtime: never serve a prerendered list
  return json(store.exercises.filter((exercise) => store.favorites.has(exercise.id)));
}

export async function POST(req: Request) {
  let id: string | undefined;
  try {
    id = ((await req.json()) as { exerciseId?: string }).exerciseId;
  } catch {
    id = new URL(req.url).searchParams.get("exerciseId") ?? undefined;
  }
  if (id) store.favorites.add(id);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("exerciseId");
  if (id) store.favorites.delete(id);
  return json({ ok: true });
}
