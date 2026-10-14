import { cookies } from "next/headers";
import { SESSION_COOKIE, createSession, loginUser } from "@/lib/auth";
import { json, readJson } from "@/lib/http";

type Body = { email?: unknown; password?: unknown };

// POST {email, password} -> 200 {token, user} + session cookie | 401 bad credentials.
export async function POST(req: Request) {
  const body = await readJson<Body>(req);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return json({ error: "email and password are required" }, { status: 400 });
  }

  const result = await loginUser(body.email, body.password);
  if (!result.ok) return json({ error: result.error }, { status: 401 });

  const session = await createSession(result.user.id);
  if (!session.ok) return json({ error: session.error }, { status: 500 });

  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, { httpOnly: true, sameSite: "lax", path: "/" });
  return json({ token: session.token, user: result.user });
}
