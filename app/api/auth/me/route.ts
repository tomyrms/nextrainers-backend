import { getUserFromRequest } from "@/lib/auth";
import { json } from "@/lib/http";

// GET -> the authenticated user, or {user: null} when no valid session is sent.
export async function GET(req: Request) {
  return json({ user: await getUserFromRequest(req) });
}
