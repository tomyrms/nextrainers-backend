// Shared skill-merge helper for the player skill endpoints (contract §4).
// Manual changes are dependency-free on purpose: the clone stores whatever the
// client sends, keeping existing skill names and appending unknown ids.
import type { Player, PlayerSkill } from "./seed";

type SkillUpdate = Partial<Pick<PlayerSkill, "id" | "value">>;

// Merges [{id, value}] updates into the player's skill list: known ids get the
// new value (name preserved), unknown ids are appended with the id as name.
// Invalid entries are skipped so a malformed body cannot break the roster.
export function applySkillUpdates(player: Player, updates: SkillUpdate[]): void {
  for (const update of updates) {
    if (!update || typeof update.id !== "string" || update.id.length === 0) continue;
    if (typeof update.value !== "number" || !Number.isFinite(update.value)) continue;

    const existing = player.skills.find((skill) => skill.id === update.id);
    if (existing) existing.value = update.value;
    else player.skills.push({ id: update.id, name: update.id, value: update.value });
  }
}
