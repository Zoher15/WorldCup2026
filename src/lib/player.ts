import { createAdminClient } from "./supabase/admin";
import { normalizeCode } from "./codes";
import { predictionState, type PredictionState } from "./prediction-rules";
import { scorePrediction } from "./recompute";
import type { Stage } from "./types";

export interface PlayerPredictionRow {
  matchId: string;
  matchNumber: number | null;
  stage: Stage;
  groupLabel: string | null;
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  kickoffAt: string;
  venue: string | null;
  state: PredictionState;
  /** Whether the player has entered a prediction (always visible). */
  hasPrediction: boolean;
  /**
   * The actual scoreline pick — revealed only to the player themselves, or to
   * anyone once the match has kicked off. null means "hidden" or "none".
   */
  pick: { home: number; away: number; advancePick: string | null } | null;
  /** The confirmed match result, when available. */
  result: { home: number; away: number; advancedCode: string | null } | null;
  /** Points earned, when scored and counted under the group's policy. */
  points: number | null;
}

export interface PlayerProfile {
  group: { code: string; name: string };
  player: { displayName: string; isViewer: boolean };
  rows: PlayerPredictionRow[];
  summary: { predicted: number; total: number; points: number };
}

/**
 * One player's predictions within a group, with privacy enforced: a pick for a
 * match that hasn't kicked off is only revealed to the player themselves —
 * everyone else just sees whether they've entered one. Past (kicked-off)
 * matches are fully revealed, with the result and points earned.
 *
 * Returns null if the group or the player's membership in it doesn't exist.
 */
export async function getPlayerProfile(opts: {
  code: string;
  userId: string;
  viewerId: string | null;
}): Promise<PlayerProfile | null> {
  const db = createAdminClient();

  const { data: group } = await db
    .from("groups")
    .select("id, code, name, late_join_policy, created_at")
    .eq("code", normalizeCode(opts.code))
    .single();
  if (!group) return null;

  // The player must belong to THIS group (also yields their per-group name).
  const { data: membership } = await db
    .from("memberships")
    .select("display_name")
    .eq("group_id", group.id)
    .eq("user_id", opts.userId)
    .single();
  if (!membership) return null;

  const [matchesRes, predsRes] = await Promise.all([
    db
      .from("matches")
      .select(
        "id, match_number, stage, group_label, home_code, away_code, home_team, away_team, kickoff_at, venue, home_goals, away_goals, advanced_code, result_confirmed",
      )
      .order("kickoff_at", { ascending: true }),
    db
      .from("predictions")
      .select("match_id, pred_home, pred_away, advance_pick")
      .eq("user_id", opts.userId),
  ]);
  const matches = matchesRes.data ?? [];
  const predByMatch = new Map((predsRes.data ?? []).map((p) => [p.match_id, p]));

  const isViewer = opts.viewerId === opts.userId;
  const lowerBound =
    group.late_join_policy === "start_even" ? Date.parse(group.created_at) : null;

  let predicted = 0;
  let points = 0;
  const rows: PlayerPredictionRow[] = matches.map((m) => {
    const state = predictionState(m.kickoff_at);
    const pred = predByMatch.get(m.id);
    const hasPrediction = pred != null;
    if (hasPrediction) predicted++;

    // Reveal the pick only to the owner, or once the match has kicked off.
    const reveal = hasPrediction && (isViewer || state === "locked");
    const pick = reveal
      ? { home: pred!.pred_home, away: pred!.pred_away, advancePick: pred!.advance_pick }
      : null;

    const result =
      m.result_confirmed && m.home_goals != null && m.away_goals != null
        ? { home: m.home_goals, away: m.away_goals, advancedCode: m.advanced_code }
        : null;

    // Points count only when the match falls within the group's scoring window.
    let rowPoints: number | null = null;
    const counts = lowerBound == null || Date.parse(m.kickoff_at) >= lowerBound;
    if (hasPrediction && counts) {
      const score = scorePrediction(
        {
          id: "",
          predHome: pred!.pred_home,
          predAway: pred!.pred_away,
          advancePick: pred!.advance_pick,
        },
        {
          resultConfirmed: m.result_confirmed,
          homeGoals: m.home_goals,
          awayGoals: m.away_goals,
          stage: m.stage,
          advancedCode: m.advanced_code,
        },
      );
      if (score) {
        rowPoints = score.totalPoints;
        points += score.totalPoints;
      }
    }

    return {
      matchId: m.id,
      matchNumber: m.match_number,
      stage: m.stage,
      groupLabel: m.group_label,
      homeCode: m.home_code,
      awayCode: m.away_code,
      homeLabel: m.home_team,
      awayLabel: m.away_team,
      kickoffAt: m.kickoff_at,
      venue: m.venue,
      state,
      hasPrediction,
      pick,
      result,
      points: rowPoints,
    };
  });

  return {
    group: { code: group.code, name: group.name },
    player: { displayName: membership.display_name, isViewer },
    rows,
    summary: { predicted, total: matches.length, points },
  };
}
