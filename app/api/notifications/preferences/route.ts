import { json, readJson } from "@/lib/http";

const prefs = { push: false, email: false, trainings: true, season: true, club: true };

export function GET() {
  return json(prefs);
}

export async function PUT(req: Request) {
  const body = await readJson<Record<string, unknown>>(req);
  if (body) Object.assign(prefs, body);
  return json(prefs);
}
