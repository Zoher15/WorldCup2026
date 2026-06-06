/**
 * Scoring engine for the World Cup 2026 prediction game.
 *
 * Each match prediction is worth up to 10 points, split into two independent
 * parts that always sum to the total:
 *
 *   1. Outcome points (0, 3, or 6) — did you back the right direction?
 *        - Right winner, or right draw .................... 6
 *        - One step off (predicted draw, someone won, or
 *          vice-versa) ................................... 3
 *        - Backed the wrong team entirely ................. 0
 *
 *   2. Closeness points (0–4) — how close was the scoreline?
 *        closeness = max(0, 4 - totalGoalError)
 *        where totalGoalError = |predHome - actualHome| + |predAway - actualAway|
 *
 * This means:
 *   - Picking the wrong winner is punished twice as hard (−6) as
 *     predicting a draw (−3).
 *   - Over-/under-shooting the goal count bleeds points smoothly, so a
 *     5–0 prediction beats 6–0 beats 10–0 when the real score is 5–0.
 *
 * Because the two parts are independent and additive, they also power three
 * leaderboards for free:
 *   - "Win predictor"      = sum of outcome points
 *   - "Scoreline predictor"= sum of closeness points
 *   - "Overall champion"   = sum of totals
 */

/** The three possible directions of a match result. */
export type Direction = "HOME" | "DRAW" | "AWAY";

/** A scoreline — either a prediction or the real result. */
export interface Scoreline {
  homeGoals: number;
  awayGoals: number;
}

/** The breakdown of points earned for a single match prediction. */
export interface MatchScore {
  /** Outcome points: 0, 3, or 6. */
  outcome: number;
  /** Closeness points: 0–4. */
  closeness: number;
  /** Total points: 0–10 (always outcome + closeness). */
  total: number;
}

/** Maximum points available for a single match (scoreline only). */
export const MAX_MATCH_POINTS = 10;

/**
 * Bonus for correctly predicting which team advances in a knockout match
 * (after extra time / penalties). Kept modest relative to the 10 scoreline
 * points so the scoreline stays the main event.
 */
export const ADVANCE_BONUS = 3;

const OUTCOME_FOR_CORRECT_DIRECTION = 6;
const OUTCOME_PENALTY_PER_STEP = 3;
const MAX_CLOSENESS_POINTS = 4;

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

/** Outcome points (0, 3, or 6) for a prediction vs the actual result. */
function outcomePoints(prediction: Scoreline, actual: Scoreline): number {
  const steps = directionSteps(direction(prediction), direction(actual));
  return Math.max(0, OUTCOME_FOR_CORRECT_DIRECTION - OUTCOME_PENALTY_PER_STEP * steps);
}

/** Closeness points (0–4) for a prediction vs the actual result. */
function closenessPoints(prediction: Scoreline, actual: Scoreline): number {
  const goalError =
    Math.abs(prediction.homeGoals - actual.homeGoals) +
    Math.abs(prediction.awayGoals - actual.awayGoals);
  return Math.max(0, MAX_CLOSENESS_POINTS - goalError);
}

/**
 * Scores a single match prediction against the actual result, returning the
 * full breakdown. Throws on invalid (non-integer or negative) scorelines.
 */
export function scoreMatch(prediction: Scoreline, actual: Scoreline): MatchScore {
  assertValidScoreline("prediction", prediction);
  assertValidScoreline("actual", actual);

  const outcome = outcomePoints(prediction, actual);
  const closeness = closenessPoints(prediction, actual);
  return { outcome, closeness, total: outcome + closeness };
}

/**
 * Bonus points for a knockout "who advances?" pick.
 *
 * Returns ADVANCE_BONUS if the picked team matches the team that actually
 * advanced, otherwise 0. A null/absent pick or unknown result scores 0.
 * This is added on top of the scoreline points for knockout matches, so a
 * perfect knockout prediction is worth MAX_MATCH_POINTS + ADVANCE_BONUS.
 */
export function advancePoints(
  pick: string | null | undefined,
  actualAdvancedCode: string | null | undefined,
): number {
  if (!pick || !actualAdvancedCode) return 0;
  return pick === actualAdvancedCode ? ADVANCE_BONUS : 0;
}
