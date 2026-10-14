import { json } from "@/lib/http";
import { store } from "@/lib/store";

export function GET() {
  return json({ dismissed: store.dismissals["discovery-popup"] === true });
}

export function POST() {
  store.dismissals["discovery-popup"] = true;
  return json({ dismissed: true });
}
