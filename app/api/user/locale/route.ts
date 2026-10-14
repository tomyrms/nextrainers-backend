import { json, readJson } from "@/lib/http";
import { store } from "@/lib/store";

// PUT /api/user/locale body { locale: "fr"|"en"|"de" } -> any 2xx (contract §10).
export async function PUT(req: Request) {
  const body = await readJson<{ locale?: string }>(req);
  if (body?.locale) store.profile.locale = body.locale;
  return json({ ok: true });
}
