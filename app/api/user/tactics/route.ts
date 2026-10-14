import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";

function handleGET() {
  return json(store.tactics);
}

async function handlePUT(req: Request) {
  const body = await readJson(req);
  store.tactics = (body ?? {}) as Record<string, unknown>;
  return json(store.tactics);
}

export const GET = withStore(handleGET);
export const PUT = withStore(handlePUT);
