/**
 * A team's result in a finished match, from its own side — the one bit of
 * scoring logic on the country schedule. Kept in its own DB-free module so it
 * can be unit-tested without dragging in the Supabase client.
 */

import { isKnockoutStage } from "./polling.ts";
import type { Stage } from "./types.ts";

/** This team's result in a finished match — a knockout tie settled on penalties
 *  counts as a win or loss for the side that advanced, never a draw. */
export type TeamOutcome = "W" | "D" | "L";

/** This team's outcome for a finished match. A level scoreline is a genuine draw
 *  in the group stage, but a knockout tie is decided on penalties — the team
 *  that advanced wins, the other loses. */
export function teamOutcome(
  result: { home: number; away: number; advancedCode: string | null },
  isHome: boolean,
  code: string,
  stage: Stage,
): TeamOutcome {
  if (result.home !== result.away) {
    const won = isHome ? result.home > result.away : result.away > result.home;
    return won ? "W" : "L";
  }
  if (isKnockoutStage(stage) && result.advancedCode) {
    return result.advancedCode === code ? "W" : "L";
  }
  return "D";
}
