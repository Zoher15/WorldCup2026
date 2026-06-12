/**
 * Shared match-state predicates, structurally typed so they work across the
 * app's match/row shapes (derived profile rows, the predict board's flat
 * matches, raw snake_case DB rows). Pure — safe on server and client.
 */

import type { PredictionState } from "./prediction-rules";

/** A match that's been finalized (a result exists) — the only thing that
 *  belongs on a "past results" view. */
export function isFinal(row: { result: unknown }): boolean {
  return row.result != null;
}

/** Kicked off but not yet finalized — in play, whether or not the live-score
 *  feed has caught up yet. Stays in "current" views; never falls to "past"
 *  (so a just-kicked-off match doesn't briefly vanish into past results). */
export function isInPlay(row: {
  state: PredictionState;
  result: unknown;
}): boolean {
  return row.state === "locked" && row.result == null;
}

/** In play AND we have a live score to show (drives the live card visual). */
export function isLive(row: {
  state: PredictionState;
  result: unknown;
  live: unknown;
}): boolean {
  return isInPlay(row) && row.live != null;
}

/** A kicked-off, in-play match on the predict board (locked, live status,
 *  score present) — the flat shape with no derived result/live objects. */
export function isLiveMatch(m: {
  state: PredictionState;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
}): boolean {
  return (
    m.state === "locked" &&
    m.status === "live" &&
    m.homeGoals != null &&
    m.awayGoals != null
  );
}

/** Over per the feed: the status reports finished, or an admin confirmed the
 *  result — we don't wait on the confirmation gate to treat a match as final. */
export function isMatchOver(m: {
  status: string;
  result_confirmed: boolean;
}): boolean {
  return m.status === "finished" || m.result_confirmed;
}
