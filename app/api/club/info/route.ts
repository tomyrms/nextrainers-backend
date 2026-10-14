import { json } from "@/lib/http";
import { store, withStore } from "@/lib/store";

// GET /api/club/info -> { club } (contract §12); the client reads club.name
// and gates the supervisor UI on club.isSupervisor.
function handleGET() {
  return json({ club: store.club });
}

export const GET = withStore(handleGET);
