/**
 * Pure prediction rules — no database imports, so they're cheap to unit-test
 * and safe to use on both server and client.
 */

/** A match locks for predictions once kickoff has passed. */
export function isLocked(kickoffAt: string, now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(kickoffAt);
}

/** Validate a prediction's goals (non-negative integers, sane upper bound). */
export function isValidGoals(home: number, away: number): boolean {
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 30;
  return ok(home) && ok(away);
}
