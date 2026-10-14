import { connection } from "next/server";
import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// GET /api/notifications/inbox -> { notifications, unreadCount } (contract §9).
// Read receipts mutate the list, so always render per request.
async function handleGET() {
  await connection();
  const unreadCount = store.notifications.filter((n) => n.readAt === null).length;
  return json({ notifications: store.notifications, unreadCount });
}

export const GET = withStore(handleGET);
