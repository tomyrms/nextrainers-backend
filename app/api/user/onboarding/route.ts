import { json } from "@/lib/http";
import { store } from "@/lib/store";

export function GET() {
  return json(store.onboarding);
}

export function POST() {
  store.onboarding.completed = true;
  return json(store.onboarding);
}
