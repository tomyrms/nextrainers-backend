import { json } from "@/lib/http";
import { store } from "@/lib/store";

export function GET() {
  return json(store.profile);
}
