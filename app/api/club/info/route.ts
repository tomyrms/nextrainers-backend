import { json } from "@/lib/http";
import { store } from "@/lib/store";

// GET /api/club/info -> { club } (contract §12); the client reads club.name
// and gates the supervisor UI on club.isSupervisor.
export function GET() {
  return json({ club: store.club });
}
