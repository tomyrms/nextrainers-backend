import { json } from "@/lib/http";
import { store } from "@/lib/store";

// Client contract (chunk 3910):
//   GET /api/exercises/favorite -> list of favorite ids
//   POST /api/exercises/favorite { exerciseId }
//   DELETE /api/exercises/favorite?exerciseId=...
export function GET() {
  return json({ favoriteIds: [...store.favorites] });
}

export async function POST(req: Request) {
  let id: string | undefined;
  try {
    id = ((await req.json()) as { exerciseId?: string }).exerciseId;
  } catch {
    id = new URL(req.url).searchParams.get("exerciseId") ?? undefined;
  }
  if (id) store.favorites.add(id);
  return json({ ok: true, favoriteIds: [...store.favorites] });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("exerciseId");
  if (id) store.favorites.delete(id);
  return json({ ok: true, favoriteIds: [...store.favorites] });
}
