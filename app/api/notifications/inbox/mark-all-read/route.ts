import { json } from "@/lib/http";
import { store } from "@/lib/store";

// POST /api/notifications/inbox/mark-all-read (no body) -> response unused (2xx).
export function POST() {
  const now = new Date().toISOString();
  for (const notification of store.notifications) {
    if (notification.readAt === null) notification.readAt = now;
  }
  return json({ ok: true });
}
