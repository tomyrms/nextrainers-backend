import { json } from "@/lib/http";

export function GET() {
  return json({ context: null, suggestions: [] });
}
