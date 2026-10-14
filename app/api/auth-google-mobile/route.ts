import { json, readJson } from "@/lib/http";

// Mobile Google sign-in: the shipped app posts an idToken here and receives a
// Clerk sign-in ticket. The clone has no auth provider yet - accept and echo.
export async function POST(req: Request) {
  const body = await readJson<{ idToken?: string }>(req);
  return json({
    ok: Boolean(body?.idToken),
    token: "clone-ticket-" + Date.now(),
    message: "Auth provider not wired in the clone yet.",
  });
}
