import { connection } from "next/server";
import { json } from "@/lib/http";
import { persistSoon, store } from "@/lib/store";

// GET /api/analysis/:id -> the stored analysis with a createdAt (contract §7:
// shape not captured client-side, so the stored object passes through as is);
// 404 { error: "not_found" } for unknown ids.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;

  const analysis = store.analyses.find((entry) => entry.id === id);
  if (!analysis) return json({ error: "not_found" }, { status: 404 });

  if (!analysis.createdAt) {
    analysis.createdAt = new Date().toISOString();
    persistSoon();
  }
  return json(analysis);
}
