import { json, readJson } from "@/lib/http";
import { store } from "@/lib/store";

// Season plan: null means "no season yet" (the app shows its empty state).
export function GET() {
  return json({ plan: store.seasonPlans[0] ?? null });
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const plan = { id: `sp_${Date.now()}`, ...(body ?? {}) };
  store.seasonPlans = [plan];
  return json({ plan });
}
