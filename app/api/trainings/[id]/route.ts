import { json } from "@/lib/http";
import { store } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const training = store.trainings.find((t) => (t as { id?: string }).id === id);
  return training ? json(training) : json({ error: "not_found" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  store.trainings = store.trainings.filter((t) => (t as { id?: string }).id !== id);
  return json({ ok: true });
}
