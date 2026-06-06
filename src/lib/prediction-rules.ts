/**
 * Pure prediction rules — no database imports, so they're cheap to unit-test
 * and safe to use on both server and client.
 */

/**
 * How long before kickoff the prediction window opens, in hours. Defaults to 24
 * and is overridable per deployment via NEXT_PUBLIC_PREDICTION_WINDOW_HOURS
 * (e.g. 48 for a gentler window, or a very large number to keep predictions
 * always open). One global dial for the whole game — it applies to every group,
 * which is why predictions can stay shared across groups.
 *
 * Must be NEXT_PUBLIC_ because it also drives the on-screen countdowns, so the
 * client and server have to agree on the same value.
 */
const DEFAULT_WINDOW_HOURS = 24;

function resolveWindowHours(): number {
  const raw = process.env.NEXT_PUBLIC_PREDICTION_WINDOW_HOURS;
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WINDOW_HOURS;
}

export const PREDICTION_WINDOW_HOURS = resolveWindowHours();

const WINDOW_MS = PREDICTION_WINDOW_HOURS * 60 * 60 * 1000;

export type PredictionState = "upcoming" | "open" | "locked";

/** Epoch ms when the prediction window opens (kickoff − window). */
export function windowOpensAt(kickoffAt: string): number {
  return Date.parse(kickoffAt) - WINDOW_MS;
}

/** A match locks for predictions once kickoff has passed. */
export function isLocked(kickoffAt: string, now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(kickoffAt);
}

/** The window is open from (kickoff − window) until kickoff. */
export function isWindowOpen(kickoffAt: string, now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= windowOpensAt(kickoffAt) && t < Date.parse(kickoffAt);
}

/** Where a match sits relative to its prediction window. */
export function predictionState(
  kickoffAt: string,
  now: Date = new Date(),
): PredictionState {
  const t = now.getTime();
  if (t >= Date.parse(kickoffAt)) return "locked";
  if (t >= windowOpensAt(kickoffAt)) return "open";
  return "upcoming";
}

/** Validate a prediction's goals (non-negative integers, sane upper bound). */
export function isValidGoals(home: number, away: number): boolean {
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 30;
  return ok(home) && ok(away);
}
