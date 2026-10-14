import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// PUT /api/user/locale body { locale: "fr"|"en"|"de" } -> any 2xx (contract §10).
async function handlePUT(req: Request) {
  const body = await readJson<{ locale?: string }>(req);
  if (body?.locale) store.profile.locale = body.locale;
  return json({ ok: true });
}

export const PUT = withStore(handlePUT);
