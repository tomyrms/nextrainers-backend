import { json } from "@/lib/http";

// GET /api/user/country -> { country } (appendix of the contract).
export function GET() {
  return json({ country: "FR" });
}
