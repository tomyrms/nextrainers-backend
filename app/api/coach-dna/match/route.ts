import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// GET /api/coach-dna/match -> { match } (appendix endpoint; null until saved).
// POST body = the match object -> { match } (the client reads `.match` back).
// The clone has no coach-DNA engine: it stores what the client sends.
async function handleGET() {
  return json({ match: store.coachDnaMatch });
}

async function handlePOST(req: Request) {
  const body = await readJson<Record<string, unknown>>(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "match object required" }, { status: 400 });
  }
  store.coachDnaMatch = { ...body, savedAt: new Date().toISOString() };
  return json({ match: store.coachDnaMatch });
}

// DELETE -> { match: null } (reset; not used by the shipped client).
async function handleDELETE() {
  store.coachDnaMatch = null;
  return json({ match: null });
}

export const GET = withStore(handleGET);
export const POST = withStore(handlePOST);
export const DELETE = withStore(handleDELETE);
