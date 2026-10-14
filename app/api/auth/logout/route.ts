import { cookies } from "next/headers";
import { SESSION_COOKIE, destroySession, getSessionToken } from "@/lib/auth";
import { json } from "@/lib/http";

// POST -> drops the session (from header or cookie) and clears the cookie.
export async function POST(req: Request) {
  const token = getSessionToken(req);
  if (token) destroySession(token);

  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return json({ ok: true });
}
