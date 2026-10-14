import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";

function handleGET() {
  return json({ dismissed: store.dismissals["discovery-popup"] === true });
}

function handlePOST() {
  store.dismissals["discovery-popup"] = true;
  return json({ dismissed: true });
}

export const GET = withStore(handleGET);
export const POST = withStore(handlePOST);
