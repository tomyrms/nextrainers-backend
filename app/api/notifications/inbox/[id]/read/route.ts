import { json } from "@/lib/http";
import { persistSoon, store, withStore } from "@/lib/store";

// PATCH /api/notifications/inbox/:id/read (no body) -> response unused (2xx).
// The notification is a raw element of the store list, so signal the store's
// persistence hook explicitly after the in-place update.
async function handlePATCH(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const notification = store.notifications.find((n) => n.id === id);
  if (notification && notification.readAt === null) {
    notification.readAt = new Date().toISOString();
    persistSoon();
  }
  return json({ ok: true });
}

export const PATCH = withStore(handlePATCH);
