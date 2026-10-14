import { connection } from "next/server";
import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// GET /api/user/profile -> full profile object (contract §8).
// The profile is mutable (PUT below), so always render per request.
async function handleGET() {
  await connection();
  return json(store.profile);
}

// PUT /api/user/profile — partial update of the fields the client sends;
// response body is not read by the client (any 2xx).
async function handlePUT(req: Request) {
  const body = await readJson<Record<string, unknown>>(req);
  const allowed = ["fullName", "dateOfBirth", "teamName", "experience", "level"] as const;
  for (const key of allowed) {
    if (body && body[key] !== undefined) store.profile[key] = body[key] as never;
  }
  return json(store.profile);
}

export const GET = withStore(handleGET);
export const PUT = withStore(handlePUT);
