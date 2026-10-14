import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";

function handleGET() {
  return json(store.onboarding);
}

function handlePOST() {
  store.onboarding.completed = true;
  return json(store.onboarding);
}

export const GET = withStore(handleGET);
export const POST = withStore(handlePOST);
