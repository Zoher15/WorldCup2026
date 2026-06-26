/**
 * Recompute / disaster-recovery logic.
 *
 * The durability guarantee: the only *source of truth* is what users entered —
 * their raw `predictions` — plus the confirmed match results. Every point and
 * every leaderboard position is DERIVED from those two things by a pure
 * function, so it can be rebuilt from scratch at any time:
 *
 *   - Relaunching or redeploying the site changes nothing (the app is
 *     stateless; all data lives in Postgres).
 *   - If the cached `match_scores` ever look wrong, we throw them away and
 *     recompute from predictions + results — deterministically and idempotently.
 *   - Correcting a wrong result (via the admin override) is just a recompute.
 *
 * This module is that pure recompute. It never mutates anything; callers persist
 * the returned rows into `match_scores`.
 */

import { scoreMatch, direction } from "./scoring.ts";
import type { Direction } from "./scoring.ts";
import { isKnockoutStage } from "./polling.ts";
import type { Match, Prediction } from "./types.ts";

export interface ComputedScore {
  predictionId: string;
  /** Outcome points at face value (0, 2, or 5), before the round multiplier. */
  outcomePoints: number;
  /** Closeness points at face value (0–5), before the round multiplier. */
  closenessPoints: number;
  /** (outcome + closeness) × the stage's round multiplier. */
  totalPoints: number;
}

type ScorableMatch = Pick<
  Match,
  | "resultConfirmed"
  | "homeGoals"
  | "awayGoals"
  | "stage"
  | "advancedCode"
  | "homeCode"
  | "awayCode"
>;

/**
 * The direction the outcome should be graded against. Normally just the
 * scoreline's direction — but a knockout tie level after extra time is decided
 * on penalties, and we store that pre-shootout draw as the scoreline. There the
 * real outcome is the team that advanced, so we map it back to HOME/AWAY. Group
 * games (where a draw is a genuine result) and knockouts won in normal/extra
 * time fall through to the scoreline's own direction.
 */
export function actualWinnerDirection(match: ScorableMatch): Direction {
  const score = { homeGoals: match.homeGoals!, awayGoals: match.awayGoals! };
  if (
    isKnockoutStage(match.stage) &&
    score.homeGoals === score.awayGoals &&
    match.advancedCode
  ) {
    if (match.advancedCode === match.homeCode) return "HOME";
    if (match.advancedCode === match.awayCode) return "AWAY";
  }
  return direction(score);
}

/**
 * A match counts toward scores only once an admin has confirmed the result and
 * both goal counts are set. This is the gate that stops a bad live API value
 * from awarding points before a human has signed off.
 */
export function isMatchScorable(match: ScorableMatch): boolean {
  return (
    match.resultConfirmed && match.homeGoals != null && match.awayGoals != null
  );
}

/**
 * Score a single saved prediction against its match. Returns null if the match
 * isn't scorable yet. Pure and idempotent: same inputs -> same output.
 */
export function scorePrediction(
  prediction: Pick<Prediction, "id" | "predHome" | "predAway" | "advancePick">,
  match: ScorableMatch,
): ComputedScore | null {
  if (!isMatchScorable(match)) return null;

  const { outcome, closeness, total } = scoreMatch(
    { homeGoals: prediction.predHome, awayGoals: prediction.predAway },
    { homeGoals: match.homeGoals!, awayGoals: match.awayGoals! },
    actualWinnerDirection(match),
    match.stage,
  );

  return {
    predictionId: prediction.id,
    outcomePoints: outcome,
    closenessPoints: closeness,
    totalPoints: total,
  };
}

/**
 * Rebuild scores for every prediction from the raw data — the full recovery
 * path. Predictions whose match is missing or not yet scorable are skipped.
 */
export function recomputeAll(
  predictions: Pick<
    Prediction,
    "id" | "matchId" | "predHome" | "predAway" | "advancePick"
  >[],
  matchesById: Map<string, ScorableMatch>,
): ComputedScore[] {
  const scores: ComputedScore[] = [];
  for (const prediction of predictions) {
    const match = matchesById.get(prediction.matchId);
    if (!match) continue;
    const score = scorePrediction(prediction, match);
    if (score) scores.push(score);
  }
  return scores;
}
