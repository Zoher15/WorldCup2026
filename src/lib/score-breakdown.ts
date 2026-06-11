/**
 * The points breakdown for one prediction against a scoreline — the "math"
 * shown when you tap a live/final match card. Pure (no DB), so it runs the same
 * on the server or in a client component, and works on a LIVE scoreline as a
 * provisional projection (scoreMatch doesn't require a confirmed result).
 */

import { scoreMatch, advancePoints } from "./scoring";
import { actualWinnerDirection } from "./recompute";
import { isKnockoutStage } from "./polling";
import type { Stage } from "./types";

export interface ScoreBreakdown {
  /** Outcome points: 0, 2, or 5 (right direction). */
  outcome: number;
  /** Closeness points: 0–5 (how near the scoreline). */
  closeness: number;
  /** Knockout "who advances" bonus (0 for group games / undecided ties). */
  advance: number;
  /** outcome + closeness + advance. */
  total: number;
  /** True for a knockout match (so the UI can show the advance row). */
  knockout: boolean;
}

export function computeBreakdown(opts: {
  pick: { home: number; away: number; advancePick?: string | null };
  result: { home: number; away: number; advancedCode?: string | null };
  stage: Stage;
  homeCode?: string | null;
  awayCode?: string | null;
}): ScoreBreakdown {
  const knockout = isKnockoutStage(opts.stage);
  const actualWinner = actualWinnerDirection({
    resultConfirmed: true,
    homeGoals: opts.result.home,
    awayGoals: opts.result.away,
    stage: opts.stage,
    advancedCode: opts.result.advancedCode ?? null,
    homeCode: opts.homeCode ?? null,
    awayCode: opts.awayCode ?? null,
  });
  const { outcome, closeness } = scoreMatch(
    { homeGoals: opts.pick.home, awayGoals: opts.pick.away },
    { homeGoals: opts.result.home, awayGoals: opts.result.away },
    actualWinner,
  );
  const advance = knockout
    ? advancePoints(opts.pick.advancePick, opts.result.advancedCode, opts.stage)
    : 0;
  return {
    outcome,
    closeness,
    advance,
    total: outcome + closeness + advance,
    knockout,
  };
}
