// Match-calendar helpers for /api/season/calendar, /api/season/quick-import
// and /api/season/next-match (contract §1, §6).
import { store } from "./store";
import type { NextMatch, SeasonMatch, SeasonPlan } from "./seed";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

type MatchInput = Partial<Record<keyof NextMatch | "source", unknown>>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Keeps the well-formed entries of a client `matches` array (dated ones only).
export function normalizeMatches(raw: unknown, seasonPlanId: string): SeasonMatch[] {
  if (!Array.isArray(raw)) return [];
  const out: SeasonMatch[] = [];
  for (const entry of raw as MatchInput[]) {
    const date = text(entry?.date);
    if (!date || !YMD.test(date) || Number.isNaN(Date.parse(date))) continue;
    out.push({
      id: "",
      seasonPlanId,
      date,
      opponent: text(entry.opponent),
      homeAway: entry.homeAway === "away" ? "away" : "home",
      competition: text(entry.competition),
      source: text(entry.source) ?? "manual",
    });
  }
  return out;
}

const matchKey = (m: Pick<SeasonMatch, "date" | "opponent">) => `${m.date}|${(m.opponent ?? "").toLowerCase()}`;

// Stores matches for a plan; `replace` drops the plan's existing ones first.
// Duplicates (same date + opponent) are skipped. Returns how many were added.
export function saveMatches(seasonPlanId: string, matches: SeasonMatch[], replace: boolean): number {
  const others = store.seasonMatches.filter((m) => m.seasonPlanId !== seasonPlanId);
  const kept = replace ? [] : store.seasonMatches.filter((m) => m.seasonPlanId === seasonPlanId);
  const seen = new Set(kept.map(matchKey));

  const added: SeasonMatch[] = [];
  for (const match of matches) {
    const key = matchKey(match);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push({ ...match, id: `m_${Date.now().toString(36)}_${kept.length + added.length + 1}` });
  }

  const merged = [...kept, ...added].sort((a, b) => a.date.localeCompare(b.date));
  store.seasonMatches = [...others, ...merged];
  return added.length;
}

export function matchesFor(seasonPlanId: string | null): SeasonMatch[] {
  return store.seasonMatches
    .filter((m) => !seasonPlanId || m.seasonPlanId === seasonPlanId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// First imported match on/after `from`, else the seeded demo match.
export function nextMatch(from: string | null): NextMatch | null {
  const today = new Date().toISOString().slice(0, 10);
  const start = from && YMD.test(from) ? from : today;
  const imported = matchesFor(null).find((m) => m.date >= start);
  if (imported) {
    const { date, opponent, homeAway, competition } = imported;
    return { date, opponent, homeAway, competition };
  }
  if (store.seasonMatches.length) return null; // an imported calendar replaces the demo match
  return store.nextMatch.date < start ? null : store.nextMatch;
}

// Plan for a category: the existing one, or a new plan cloned from the
// current one with the calendar window derived from the matches.
export function planForCategory(teamCategory: string, matches: SeasonMatch[]): SeasonPlan {
  const existing = store.seasonPlans.find((p) => p.teamCategory === teamCategory);
  if (existing) return existing;

  const template = store.seasonPlans[0];
  const dates = matches.map((m) => m.date).sort();
  const plan: SeasonPlan = {
    ...template,
    id: `plan_${Date.now().toString(36)}`,
    teamCategory,
    calendar: {
      ...template.calendar,
      championshipStartDate: dates[0] ?? template.calendar.championshipStartDate,
      championshipEndDate: dates[dates.length - 1] ?? template.calendar.championshipEndDate,
    },
  };
  store.seasonPlans.push(plan);
  return plan;
}
