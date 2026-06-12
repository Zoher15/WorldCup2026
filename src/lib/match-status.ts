/**
 * Shared derivation of a raw (snake_case) match row's display facts — whether
 * it's over, the confirmed result, the in-play score — plus the field mapping
 * every camelCase match display shape repeats.
 */

import { isMatchOver } from "./match-predicates";
import type { Stage } from "./types";

/** The raw match columns the score derivation reads. */
export interface MatchScoreSource {
  status: string;
  result_confirmed: boolean;
  home_goals: number | null;
  away_goals: number | null;
  advanced_code: string | null;
  minute: number | null;
}

/**
 * Derive `isOver` / `result` / `live` from a raw match row.
 *
 * A match is "over" the moment the feed reports it finished — we don't wait on
 * the admin confirmation gate to treat it as final. `result` and `live` are
 * mutually exclusive: the in-play score shows only while the match is live
 * (kicked off, not yet over). Callers with an extra live gate (e.g. the
 * stale-feed live-window guard) pass it via `liveAllowed` (defaults to true).
 */
export function deriveMatchScore(
  m: MatchScoreSource,
  opts: { liveAllowed?: boolean } = {},
): {
  isOver: boolean;
  result: { home: number; away: number; advancedCode: string | null } | null;
  live: { home: number; away: number; minute: number | null } | null;
} {
  const isOver = isMatchOver(m);
  const hasScore = m.home_goals != null && m.away_goals != null;
  const result =
    isOver && hasScore
      ? {
          home: m.home_goals!,
          away: m.away_goals!,
          advancedCode: m.advanced_code,
        }
      : null;
  const live =
    !isOver && m.status === "live" && hasScore && (opts.liveAllowed ?? true)
      ? { home: m.home_goals!, away: m.away_goals!, minute: m.minute }
      : null;
  return { isOver, result, live };
}

/** The raw match columns shared by every camelCase display shape. */
export interface MatchCoreSource {
  home_code: string | null;
  away_code: string | null;
  home_team: string | null;
  away_team: string | null;
  kickoff_at: string;
  stage: Stage;
  group_label: string | null;
  venue: string | null;
}

/** The snake_case→camelCase field mapping shared by the match display shapes. */
export function mapMatchFields(m: MatchCoreSource): {
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  kickoffAt: string;
  stage: Stage;
  groupLabel: string | null;
  venue: string | null;
} {
  return {
    homeCode: m.home_code,
    awayCode: m.away_code,
    homeLabel: m.home_team,
    awayLabel: m.away_team,
    kickoffAt: m.kickoff_at,
    stage: m.stage,
    groupLabel: m.group_label,
    venue: m.venue,
  };
}
