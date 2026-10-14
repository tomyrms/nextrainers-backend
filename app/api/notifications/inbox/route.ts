import { json } from "@/lib/http";

export function GET() {
  return json({ notifications: [], unreadCount: 0 });
}

export function POST() {
  return json({ ok: true });
}
