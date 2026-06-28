/**
 * Pure prediction rules — no database imports, so they're cheap to unit-test
 * and safe to use on both server and client.
 *
 * A whole match-day's games open for prediction at the SAME instant: 00:00 on
 * the day BEFORE the match day, measured "anywhere on earth" — i.e. in the
 * earliest timezone on the planet (UTC+14). So the window is open for everyone,
 * everywhere, well ahead of kickoff. Each match still LOCKS individually at its
 * own kickoff.
 *
 * Why UTC+14 anchors the grouping too: the 2026 fixtures kick off between 16:00
 * and 04:00 UTC, with no matches between 04:00 and 16:00 UTC. Shifting a kickoff
 * by +14h lands every game of one local (Americas) match-day on the same
 * calendar date and puts the day boundary squarely inside that empty UTC window
 * — so "the games on that day" group cleanly and share one open time.
 */

import type { Stage } from "./types";

/** Earliest timezone on earth (UTC+14) — the "anywhere on earth" reference. */
const AOE_OFFSET_MS = 14 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PredictionState = "upcoming" | "open" | "locked";

/**
 * The knockout stages. Unlike the group stage (which opens day-by-day), a whole
 * knockout round opens for prediction at once — every game in the round shares
 * the single open time of the round's FIRST match (see `roundOpensByStage`), so
 * once the Round of 32 opens all 16 are predictable, and so on. Each match still
 * LOCKS individually at its own kickoff.
 */
export const KNOCKOUT_STAGES: ReadonlySet<Stage> = new Set<Stage>([
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
]);

/** The World Cup's first kickoff. */
export const TOURNAMENT_START = "2026-06-11T19:00:00.000Z";

/**
 * Whether the India vs Italy practice match is still live — i.e. a predictable
 * demo on the predictions page that counts on leaderboards.
 *
 * The practice period is now OVER: the match has been retired ahead of the
 * tournament. It's closed (off the predictions page), shown on the past-
 * predictions page as history, and no longer counts on any leaderboard — so the
 * boards start fresh for real play. The `now` parameter is kept for call-site
 * compatibility (the gate used to be time-based) but the answer is now fixed.
 */
export function isTrialActive(_now: Date = new Date()): boolean {
  return false;
}

/**
 * Epoch ms when a match's day opens for prediction: midnight (UTC+14) of the
 * day before the match day. Every game on the same match-day returns the same
 * value, so they all open together.
 */
export function windowOpensAt(kickoffAt: string): number {
  // Shift into the UTC+14 clock, then read off that day's calendar date.
  const local = new Date(Date.parse(kickoffAt) + AOE_OFFSET_MS);
  const matchDayMidnight =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
    AOE_OFFSET_MS;
  // Back up one day: the window opens at the start of the day before.
  return matchDayMidnight - DAY_MS;
}

/**
 * The single open instant for each knockout round present in `matches`: the
 * earliest day-before window-open across the round's games, so the whole round
 * opens together the moment its first match would have opened under the daily
 * rule. Group matches keep the daily cadence and are omitted from the map.
 *
 * Callers that already hold a round's matches pass the resulting instant to
 * `predictionState` / `isWindowOpen` (as `opensAtMs`) for every game in that
 * round, so a later game in the round becomes predictable as soon as the round
 * opens rather than the day before its own match-day.
 */
export function roundOpensByStage(
  matches: { stage: Stage; kickoffAt: string }[],
): Map<Stage, number> {
  const opens = new Map<Stage, number>();
  for (const m of matches) {
    if (!KNOCKOUT_STAGES.has(m.stage)) continue;
    const open = windowOpensAt(m.kickoffAt);
    const prev = opens.get(m.stage);
    if (prev == null || open < prev) opens.set(m.stage, open);
  }
  return opens;
}

/** A match locks for predictions once kickoff has passed. */
export function isLocked(kickoffAt: string, now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(kickoffAt);
}

/**
 * The window is open from its open instant until kickoff. A trial (practice)
 * match is open from the start — right up until its kickoff — so it can be
 * predicted immediately, ignoring the day-before rule. `opensAtMs` overrides the
 * daily open instant (the knockout round-open anchor); omit it for the group
 * stage's day-before default.
 */
export function isWindowOpen(
  kickoffAt: string,
  now: Date = new Date(),
  isTrial = false,
  opensAtMs?: number | null,
): boolean {
  const t = now.getTime();
  if (isTrial) return t < Date.parse(kickoffAt);
  const opens = opensAtMs ?? windowOpensAt(kickoffAt);
  return t >= opens && t < Date.parse(kickoffAt);
}

/** Where a match sits relative to its prediction window. `opensAtMs` overrides
 *  the daily open instant for a knockout round (every game in the round shares
 *  one open time); omit it for the group stage's day-before default. */
export function predictionState(
  kickoffAt: string,
  now: Date = new Date(),
  isTrial = false,
  opensAtMs?: number | null,
): PredictionState {
  const t = now.getTime();
  if (t >= Date.parse(kickoffAt)) return "locked";
  const opens = opensAtMs ?? windowOpensAt(kickoffAt);
  if (isTrial || t >= opens) return "open";
  return "upcoming";
}

/** Validate a prediction's goals (non-negative integers, sane upper bound). */
export function isValidGoals(home: number, away: number): boolean {
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 30;
  return ok(home) && ok(away);
}

/**
 * Validate a knockout advance pick (or an admin's advanced-team code) against
 * the match it belongs to: absent is always fine; a non-null code is only valid
 * on a knockout match whose teams are known, and must be one of the two. Keeps
 * arbitrary codes out of the database — a typo here would otherwise silently
 * deny everyone who picked the real team their advance bonus.
 */
export function isValidAdvanceCode(
  code: string | null | undefined,
  match: { stage: string; homeCode: string | null; awayCode: string | null },
): boolean {
  if (code == null) return true;
  if (match.stage === "group") return false;
  return code === match.homeCode || code === match.awayCode;
}
