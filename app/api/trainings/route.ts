import { json, readJson } from "@/lib/http";
import { store } from "@/lib/store";

// Trainings live server-side in the original (same-origin /api). The clone keeps
// them in memory until a real database is wired in.
export function GET() {
  return json({ trainings: store.trainings });
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const training = { id: `t_${Date.now()}`, ...(body ?? {}) };
  store.trainings.unshift(training);
  return json(training);
}
