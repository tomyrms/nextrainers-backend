import { json } from "@/lib/http";
import { kvGet } from "@/lib/kv";
import { store, withStore } from "@/lib/store";

// GET /api/trainings/share/:token -> { training, sharedBy } (contract §3).
// Public: reads the copy written by POST /api/trainings/share, whichever
// account shared it; falls back to the caller's own store for tokens created
// before shares were public. 404 when the token is unknown.
async function handleGET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const shared = await kvGet(`share:${token}`);
  if (shared) {
    try {
      return json(JSON.parse(shared));
    } catch {
      // Corrupt entry: fall through to the local lookup.
    }
  }

  const trainingId = store.shareTokens.get(token);
  const training = trainingId ? store.trainings.find((t) => t.id === trainingId) : undefined;
  if (!training) return json({ error: "not_found" }, { status: 404 });
  return json({ training, sharedBy: { fullName: store.profile.fullName, teamName: store.profile.teamName } });
}

export const GET = withStore(handleGET);
