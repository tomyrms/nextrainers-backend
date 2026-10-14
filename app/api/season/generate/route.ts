import { json, readJson } from "@/lib/http";
import { store } from "@/lib/store";
import { startGeneration, type GenerationLocale } from "@/lib/generation";

type GenerateBody = { seasonPlanId?: string; locale?: string };

const LOCALES: GenerationLocale[] = ["fr", "en", "de"];

// POST /api/season/generate body { seasonPlanId, locale } -> { sessions }
// (contract §11). The client requires the `sessions` key in the response and
// awaits up to 300s: the clone starts the simulated job and waits for it.
export async function POST(req: Request) {
  const body = await readJson<GenerateBody>(req);
  const seasonPlanId = body?.seasonPlanId;

  if (!seasonPlanId || !store.seasonPlans.some((plan) => plan.id === seasonPlanId)) {
    return json({ error: "unknown_season_plan" }, { status: 404 });
  }

  const locale = LOCALES.includes(body?.locale as GenerationLocale)
    ? (body?.locale as GenerationLocale)
    : "fr";

  const job = startGeneration(seasonPlanId, locale);
  await job.done; // ~1.2s of simulated generation work

  // Full session list for the plan after generation (contract §6 shape).
  return json({ sessions: store.seasonSessions });
}
