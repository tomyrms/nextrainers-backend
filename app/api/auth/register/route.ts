import { registerUser } from "@/lib/auth";
import { json, readJson } from "@/lib/http";

type Body = { email?: unknown; password?: unknown };

// POST {email, password} -> 200 {user} | 400 invalid | 409 duplicate email.
export async function POST(req: Request) {
  const body = await readJson<Body>(req);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return json({ error: "email and password are required" }, { status: 400 });
  }

  const result = registerUser(body.email, body.password);
  if (!result.ok) {
    return json({ error: result.error }, { status: result.code === "duplicate" ? 409 : 400 });
  }
  return json({ user: result.user });
}
