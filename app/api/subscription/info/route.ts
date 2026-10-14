import { json } from "@/lib/http";
import { getSubscriptionInfo } from "@/lib/subscription";

export function GET() {
  return json(getSubscriptionInfo());
}
