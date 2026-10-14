import { json } from "@/lib/http";
import { store } from "@/lib/store";

export function GET() {
  return json({
    club: null,
    team: null,
    logoUrl: null,
    category: null,
    isClubMember: false,
    coach: store.profile,
  });
}
