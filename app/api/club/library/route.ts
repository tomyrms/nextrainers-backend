import { connection } from "next/server";
import { json } from "@/lib/http";

// GET /api/club/library -> { exercises, userContext, hasClubAccess } (appendix
// endpoint). The demo user has no club library; POST/DELETE (add/remove an
// exercise) are accepted and ignored so the UI stays graceful.
export async function GET() {
  await connection();
  return json({ exercises: [], userContext: { canManageLibrary: false }, hasClubAccess: false });
}

export async function POST() {
  return json({ ok: true });
}

export async function DELETE() {
  return json({ ok: true });
}
