/**
 * The points breakdown for one prediction against a scoreline — the "math"
 * shown when you tap a live/final match card. Pure (no DB), so it runs the same
 * on the server or in a client component, and works on a LIVE scoreline as a
 * provisional projection (scoreMatch doesn't require a confirmed result).
 */

import { scoreMatch } from "./scoring.ts";
import { actualWinnerDirection } from "./recompute.ts";
import { isKnockoutStage } from "./polling.ts";
import type { Stage } from "./types.ts";

export interface ScoreBreakdown {
  /** Outcome points at face value: 0, 2, or 5 (right direction). */
  outcome: number;
  /** Closeness points at face value: 0–5 (how near the scoreline). */
  closeness: number;
  /** Round multiplier on the total (1 for group games, more in the knockouts). */
  multiplier: number;
  /** (outcome + closeness) × multiplier. */
  total: number;
  /** True for a knockout match (so the UI can show the round-multiplier row). */
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
  const { outcome, closeness, multiplier, total } = scoreMatch(
    { homeGoals: opts.pick.home, awayGoals: opts.pick.away },
    { homeGoals: opts.result.home, awayGoals: opts.result.away },
    actualWinner,
    opts.stage,
  );
  return {
    outcome,
    closeness,
    multiplier,
    total,
    knockout,
  };
}
