import { connection } from "next/server";
import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// GET /api/exercises -> TOP-LEVEL array of exercise items (contract §2).
// The list is mutable (DELETE /api/exercises/:id), so always render per request.
async function handleGET() {
  await connection();
  return json(store.exercises);
}

export const GET = withStore(handleGET);
