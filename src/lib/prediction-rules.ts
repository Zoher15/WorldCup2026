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

/** Earliest timezone on earth (UTC+14) — the "anywhere on earth" reference. */
const AOE_OFFSET_MS = 14 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PredictionState = "upcoming" | "open" | "locked";

/**
 * The World Cup's first kickoff. The India vs Italy practice match counts
 * toward the (pre-tournament) leaderboard only before this instant; once the
 * real tournament begins, the trial stops counting.
 */
export const TOURNAMENT_START = "2026-06-11T19:00:00.000Z";

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

/** A match locks for predictions once kickoff has passed. */
export function isLocked(kickoffAt: string, now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(kickoffAt);
}

/**
 * The window is open from (the day before, 00:00 UTC+14) until kickoff. A trial
 * (practice) match is open from the start — right up until its kickoff — so it
 * can be predicted immediately, ignoring the day-before rule.
 */
export function isWindowOpen(
  kickoffAt: string,
  now: Date = new Date(),
  isTrial = false,
): boolean {
  const t = now.getTime();
  if (isTrial) return t < Date.parse(kickoffAt);
  return t >= windowOpensAt(kickoffAt) && t < Date.parse(kickoffAt);
}

/** Where a match sits relative to its prediction window. */
export function predictionState(
  kickoffAt: string,
  now: Date = new Date(),
  isTrial = false,
): PredictionState {
  const t = now.getTime();
  if (t >= Date.parse(kickoffAt)) return "locked";
  if (isTrial || t >= windowOpensAt(kickoffAt)) return "open";
  return "upcoming";
}

/** Validate a prediction's goals (non-negative integers, sane upper bound). */
export function isValidGoals(home: number, away: number): boolean {
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 30;
  return ok(home) && ok(away);
}
