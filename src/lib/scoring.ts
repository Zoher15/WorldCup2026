/**
 * Scoring engine for the World Cup 2026 prediction game.
 *
 * Each match prediction has two skill parts, then a per-round multiplier on the
 * total so the knockouts carry as much weight as the whole group stage:
 *
 *   1. Outcome points (0, 2, or 5) — did you back the right direction?
 *        - Right winner, or right draw .................... 5
 *        - One step off (predicted draw, someone won, or
 *          vice-versa) ................................... 2
 *        - Backed the wrong team entirely ................. 0
 *
 *   2. Closeness points (0–5) — how close was the scoreline?
 *        closeness = max(0, 5 - totalGoalError)
 *        where totalGoalError = |predHome - actualHome| + |predAway - actualAway|
 *
 *   3. Round multiplier — the whole match (outcome + closeness) is multiplied by
 *      SCORE_MULTIPLIER[stage]. Group games count at face value (×1); each
 *      knockout round climbs by one, peaking at the final (×6). With this ladder
 *      the knockouts are worth 930 points to the group stage's 720 (≈56% of the
 *      1650 on offer), so the knockouts outweigh the groups and a strong
 *      knockout run can overturn a group-stage lead — see scoring.test.ts.
 *
 * `outcome` and `closeness` are reported at FACE VALUE (un-multiplied), so the
 * "Outcome predictor" and "Scoreline predictor" leaderboards measure pure skill
 * independent of round, while `total` (= (outcome + closeness) × multiplier)
 * drives the "Overall champion" board where the deep rounds pay off.
 *
 * This means:
 *   - Picking the wrong winner costs all 5 outcome points, while a draw
 *     guess only costs 3 — a wrong winner is punished harder.
 *   - Over-/under-shooting the goal count bleeds points smoothly, so a
 *     5–0 prediction beats 6–0 beats 10–0 when the real score is 5–0.
 */

import type { Stage } from "./types";

/** The three possible directions of a match result. */
export type Direction = "HOME" | "DRAW" | "AWAY";

/** A scoreline — either a prediction or the real result. */
export interface Scoreline {
  homeGoals: number;
  awayGoals: number;
}

/** The breakdown of points earned for a single match prediction. */
export interface MatchScore {
  /** Outcome points at face value: 0, 2, or 5 (before the round multiplier). */
  outcome: number;
  /** Closeness points at face value: 0–5 (before the round multiplier). */
  closeness: number;
  /** The round multiplier applied to the total (SCORE_MULTIPLIER[stage]). */
  multiplier: number;
  /** Total points: (outcome + closeness) × multiplier. */
  total: number;
}

/** Outcome points for backing the right winner (or the right draw) — i.e. a
 *  "correct direction" call. One step off scores less; the opposite, nothing. */
export const OUTCOME_FOR_CORRECT_DIRECTION = 5;
const OUTCOME_PENALTY_PER_STEP = 3;
const MAX_CLOSENESS_POINTS = 5;

/** Face-value points for a single match (outcome + closeness), before the round
 *  multiplier — the group-stage ceiling. */
export const MAX_MATCH_POINTS = OUTCOME_FOR_CORRECT_DIRECTION + MAX_CLOSENESS_POINTS;

/**
 * Per-round multiplier on the whole match score. Group games score at face
 * value (×1); each knockout round climbs by one — Round of 32 ×2 up to the
 * final ×6 — so the deeper you go the more every call matters. With this ladder
 * the 32 knockout matches are worth 930 points in total, more than the 720 from
 * the 72 group games, so the knockouts outweigh the group stage. Third place is
 * level with the semi-final (×5).
 */
export const SCORE_MULTIPLIER: Record<Stage, number> = {
  group: 1,
  round_of_32: 2,
  round_of_16: 3,
  quarter_final: 4,
  semi_final: 5,
  third_place: 5,
  final: 6,
};

/** The most a single match can be worth (a flawless prediction) for a stage. */
export function maxMatchPoints(stage: Stage): number {
  return MAX_MATCH_POINTS * SCORE_MULTIPLIER[stage];
}

/** Validates that a scoreline is made of non-negative whole numbers. */
function assertValidScoreline(label: string, score: Scoreline): void {
  for (const [side, goals] of [
    ["home", score.homeGoals],
    ["away", score.awayGoals],
  ] as const) {
    if (!Number.isInteger(goals) || goals < 0) {
      throw new RangeError(
        `${label} ${side} goals must be a non-negative integer, got ${goals}`,
      );
    }
  }
}

/** Returns the direction (winner) of a scoreline. */
export function direction({ homeGoals, awayGoals }: Scoreline): Direction {
  if (homeGoals > awayGoals) return "HOME";
  if (homeGoals < awayGoals) return "AWAY";
  return "DRAW";
}

/**
 * How many "steps" apart two directions are on the HOME–DRAW–AWAY scale.
 *   - same direction ................... 0
 *   - win-vs-draw (one step) ........... 1
 *   - home-win-vs-away-win (opposite) .. 2
 */
function directionSteps(a: Direction, b: Direction): 0 | 1 | 2 {
  const rank: Record<Direction, number> = { HOME: 1, DRAW: 0, AWAY: -1 };
  return Math.abs(rank[a] - rank[b]) as 0 | 1 | 2;
}

/** Outcome points (0, 2, or 5) for a predicted vs actual direction. */
function outcomePoints(predicted: Direction, actual: Direction): number {
  const steps = directionSteps(predicted, actual);
  return Math.max(0, OUTCOME_FOR_CORRECT_DIRECTION - OUTCOME_PENALTY_PER_STEP * steps);
}

/** Closeness points (0–5) for a prediction vs the actual result. */
function closenessPoints(prediction: Scoreline, actual: Scoreline): number {
  const goalError =
    Math.abs(prediction.homeGoals - actual.homeGoals) +
    Math.abs(prediction.awayGoals - actual.awayGoals);
  return Math.max(0, MAX_CLOSENESS_POINTS - goalError);
}

/**
 * Scores a single match prediction against the actual result, returning the
 * full breakdown. Throws on invalid (non-integer or negative) scorelines.
 *
 * `actualWinner` overrides the direction the outcome is graded against. It
 * exists for knockout ties decided on penalties: the stored scoreline is the
 * end-of-extra-time draw, but the tie HAD a winner (the team that advanced), so
 * the caller passes that side and a prediction backing it earns full outcome
 * points — exactly like a regular-time win. Closeness is always graded against
 * the literal scoreline. Defaults to the scoreline's own direction (the right
 * behaviour for group games).
 *
 * `stage` selects the round multiplier applied to the total (defaults to
 * "group", i.e. face value).
 */
export function scoreMatch(
  prediction: Scoreline,
  actual: Scoreline,
  actualWinner: Direction = direction(actual),
  stage: Stage = "group",
): MatchScore {
  assertValidScoreline("prediction", prediction);
  assertValidScoreline("actual", actual);

  const outcome = outcomePoints(direction(prediction), actualWinner);
  const closeness = closenessPoints(prediction, actual);
  const multiplier = SCORE_MULTIPLIER[stage];
  return { outcome, closeness, multiplier, total: (outcome + closeness) * multiplier };
}
