import { connection } from "next/server";
import { json } from "@/lib/http";

// GET /api/club/logo -> { logoUrl, canManageLogo } (contract §12). The demo
// club has no logo and no supervisor UI.
export async function GET() {
  await connection();
  return json({ logoUrl: null, canManageLogo: false });
}
