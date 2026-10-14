import { json, readJson } from "@/lib/http";
import { store } from "@/lib/store";

export function GET() {
  return json(store.tactics);
}

export async function PUT(req: Request) {
  const body = await readJson(req);
  store.tactics = (body ?? {}) as Record<string, unknown>;
  return json(store.tactics);
}
