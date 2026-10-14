import { json } from "@/lib/http";
import { store } from "@/lib/store";

// GET /api/trainings/:id -> the same session object as the list (contract §3).
// Deletion went to DELETE /api/trainings?id= (query param) per the contract.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const training = store.trainings.find((t) => t.id === id);
  return training ? json(training) : json({ error: "not_found" }, { status: 404 });
}
