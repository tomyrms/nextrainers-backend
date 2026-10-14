import { json } from "@/lib/http";
import { store } from "@/lib/store";

// GET /api/trainings/share/:token -> { training, sharedBy } (contract §3).
// 404 when the token is unknown or the training was deleted.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const trainingId = store.shareTokens.get(token);
  const training = trainingId ? store.trainings.find((t) => t.id === trainingId) : undefined;
  if (!training) return json({ error: "not_found" }, { status: 404 });
  return json({ training, sharedBy: { fullName: store.profile.fullName, teamName: store.profile.teamName } });
}
