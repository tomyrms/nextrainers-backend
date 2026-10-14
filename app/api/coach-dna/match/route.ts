import { connection } from "next/server";
import { json } from "@/lib/http";

// GET/POST /api/coach-dna/match -> { match } (appendix endpoint). The clone
// has no coach-DNA engine, so the match is always null; the client tolerates it.
export async function GET() {
  await connection();
  return json({ match: null });
}

export async function POST() {
  return json({ match: null });
}
