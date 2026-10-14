import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";

function handleGET() {
  return json(store.currency);
}

export const GET = withStore(handleGET);
