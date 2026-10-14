import { json } from "@/lib/http";
import { persistSoon, store } from "@/lib/store";

// POST /api/notifications/inbox/mark-all-read (no body) -> response unused (2xx).
// The notification objects are raw store references, so signal the store's
// persistence hook explicitly after the in-place updates.
export function POST() {
  const now = new Date().toISOString();
  let changed = false;
  for (const notification of store.notifications) {
    if (notification.readAt === null) {
      notification.readAt = now;
      changed = true;
    }
  }
  if (changed) persistSoon();
  return json({ ok: true });
}
