import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";
import { buildTips } from "@/lib/tips";

// POST /api/analysis/:id/generate-tips -> { ok, tips } (contract §7: the
// client fires and forgets, the response body is never read). Tips are stored
// on the analysis so GET /api/analysis/:id returns them.
async function handlePOST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const index = store.analyses.findIndex((entry) => entry.id === id);
  if (index < 0) return json({ error: "not_found" }, { status: 404 });

  const analysis = store.analyses[index];
  const tips = buildTips(analysis);
  store.analyses[index] = { ...analysis, tips, tipsGeneratedAt: new Date().toISOString() };
  return json({ ok: true, tips });
}

export const POST = withStore(handlePOST);
