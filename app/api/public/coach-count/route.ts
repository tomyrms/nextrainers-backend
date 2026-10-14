import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";

function handleGET() {
  return json({ count: store.coachCount });
}

export const GET = withStore(handleGET);
