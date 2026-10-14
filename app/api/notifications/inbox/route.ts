import { connection } from "next/server";
import { json } from "@/lib/http";
import { store } from "@/lib/store";

// GET /api/notifications/inbox -> { notifications, unreadCount } (contract §9).
// Read receipts mutate the list, so always render per request.
export async function GET() {
  await connection();
  const unreadCount = store.notifications.filter((n) => n.readAt === null).length;
  return json({ notifications: store.notifications, unreadCount });
}
