import { json } from "@/lib/http";

export function GET() {
  return json({ slots: [], formation: "4-3-3" });
}
