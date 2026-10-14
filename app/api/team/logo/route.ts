import { connection } from "next/server";
import { json } from "@/lib/http";

// GET /api/team/logo -> { logoUrl } (contract §12). No team logo in the demo.
export async function GET() {
  await connection();
  return json({ logoUrl: null });
}
