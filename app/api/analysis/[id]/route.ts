import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// GET /api/analysis/:id -> the stored analysis with createdAt and tips
// (contract §7: shape not captured client-side, so the stored object passes
// through; `tips` is [] until generate-tips ran); 404 { error: "not_found" }.
async function handleGET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const index = store.analyses.findIndex((entry) => entry.id === id);
  if (index < 0) return json({ error: "not_found" }, { status: 404 });

  let analysis = store.analyses[index];
  if (!analysis.createdAt) {
    analysis = { ...analysis, createdAt: new Date().toISOString() };
    store.analyses[index] = analysis;
  }
  return json({ ...analysis, tips: analysis.tips ?? [] });
}

export const GET = withStore(handleGET);
