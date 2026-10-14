import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// POST /api/trainings/duplicate body { shareToken } -> { trainingId } (contract §3).
async function handlePOST(req: Request) {
  const body = await readJson<{ shareToken?: string }>(req);
  const trainingId = body?.shareToken ? store.shareTokens.get(body.shareToken) : undefined;
  const source = trainingId ? store.trainings.find((t) => t.id === trainingId) : undefined;
  if (!source) return json({ error: "not_found" }, { status: 404 });

  const copy = {
    ...source,
    id: `sess_${Date.now()}`,
    name: `${source.name} (copie)`,
    manually_created: true,
    createdAt: new Date().toISOString(),
  };
  store.trainings.unshift(copy);
  return json({ trainingId: copy.id });
}

export const POST = withStore(handlePOST);
