import { json, readJson } from "@/lib/http";
import { store, withStore } from "@/lib/store";
import { POSITIONS, newPlayer } from "@/lib/players";

type ImportPlayer = {
  firstName?: unknown;
  lastName?: unknown;
  position?: unknown;
  jerseyNumber?: unknown;
  preferredFoot?: unknown;
  dateOfBirth?: unknown;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// POST /api/players/import body { players:[{firstName, lastName, position,
// jerseyNumber, preferredFoot, dateOfBirth}] } -> { inserted, skipped,
// limitReached } (team page import modal). Rows without names or position,
// and players already on the roster (same first + last name), are skipped.
// The demo coach is premium, so there is no roster limit.
async function handlePOST(req: Request) {
  const body = await readJson<{ players?: unknown }>(req);
  if (!Array.isArray(body?.players)) return json({ error: "players must be an array" }, { status: 400 });

  const nameKey = (first: string, last: string) => `${first}|${last}`.toLowerCase();
  const existing = new Set(store.players.map((p) => nameKey(p.firstName, p.lastName)));
  let inserted = 0;
  let skipped = 0;

  for (const raw of body.players as ImportPlayer[]) {
    const firstName = str(raw?.firstName);
    const lastName = str(raw?.lastName);
    const position = str(raw?.position).toUpperCase();
    const key = nameKey(firstName, lastName);
    if (!firstName || !lastName || !(POSITIONS as readonly string[]).includes(position) || existing.has(key)) {
      skipped++;
      continue;
    }
    existing.add(key);
    const dob = str(raw?.dateOfBirth);
    store.players.push(
      newPlayer({
        firstName,
        lastName,
        position,
        jerseyNumber: typeof raw.jerseyNumber === "number" && Number.isFinite(raw.jerseyNumber) ? raw.jerseyNumber : 0,
        preferredFoot: raw.preferredFoot === "LEFT" ? "LEFT" : "RIGHT",
        dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : undefined,
      }),
    );
    inserted++;
  }

  return json({ inserted, skipped, limitReached: false });
}

export const POST = withStore(handlePOST);
