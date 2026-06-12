/**
 * Per-match leaderboard for a group: everyone's prediction for ONE match, with
 * the privacy rule the rest of the app uses — a pick stays hidden from other
 * members until the match kicks off (locks), then it's revealed alongside the
 * points it earned.
 *
 * Predictions are GLOBAL (one per person per match); a group is just a
 * membership filter plus a scoring window (its late-join policy). So this board
 * is the group's members + each one's prediction for the match, scored under the
 * group's policy. Fixed query count regardless of group size (no per-player
 * lookups) so it stays cheap for 20-30 member groups.
 */

import { createAdminClient } from "./supabase/admin";
import { normalizeCode } from "./codes";
import { liveWindowExpired } from "./polling";
import {
  predictionState,
  isTrialActive,
  type PredictionState,
} from "./prediction-rules";
import { computeBreakdown, type ScoreBreakdown } from "./score-breakdown";
import { BORINGBOT_ID, BORINGBOT_NAME } from "./standings";
import type { Stage } from "./types";

export interface MatchBoardMatch {
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  kickoffAt: string;
  stage: Stage;
  groupLabel: string | null;
  venue: string | null;
  trial: boolean;
  state: PredictionState;
  /** Confirmed full-time result, when available. */
  result: { home: number; away: number; advancedCode: string | null } | null;
  /** In-play (unconfirmed) score while the match is live; null otherwise. */
  live: { home: number; away: number; minute: number | null } | null;
}

export interface MatchBoardRow {
  userId: string;
  displayName: string;
  isViewer: boolean;
  isBot: boolean;
  /** Whether the player has entered a prediction (always known). */
  hasPrediction: boolean;
  /** The scoreline pick — revealed once the match has kicked off (or for the
   *  bot, always). null means hidden or none. */
  pick: { home: number; away: number; advancePick: string | null } | null;
  /** Counting points for THIS group; null when not yet scorable or pre-join. */
  points: number | null;
  /** The points math, when a scoreline (final or live) exists. */
  breakdown: ScoreBreakdown | null;
  /** True while the score is live (so points are a projection, not final). */
  provisional: boolean;
  /** Whether the match falls within the group's scoring window. */
  counts: boolean;
}

export interface MatchBoard {
  group: { code: string; name: string };
  match: MatchBoardMatch;
  /** True once the match has kicked off and picks may be shown to everyone. */
  revealed: boolean;
  rows: MatchBoardRow[];
  summary: { entered: number; total: number };
}

/**
 * Load a group's per-match leaderboard. Returns null if the group or the match
 * doesn't exist. Membership/authorization is the caller's responsibility (the
 * page gates non-members), matching the player-profile route.
 */
export async function getMatchLeaderboard(opts: {
  code: string;
  matchId: string;
  viewerId: string | null;
}): Promise<MatchBoard | null> {
  const db = createAdminClient();

  const { data: group } = await db
    .from("groups")
    .select("id, code, name, late_join_policy, created_at")
    .eq("code", normalizeCode(opts.code))
    .single();
  if (!group) return null;

  const { data: match } = await db
    .from("matches")
    .select(
      "id, stage, group_label, home_code, away_code, home_team, away_team, kickoff_at, venue, status, minute, home_goals, away_goals, advanced_code, result_confirmed, is_trial",
    )
    .eq("id", opts.matchId)
    .single();
  if (!match) return null;

  const { data: memberRows } = await db
    .from("memberships")
    .select("user_id, display_name")
    .eq("group_id", group.id);
  const members = memberRows ?? [];
  const userIds = members.map((m) => m.user_id);

  // One bulk query for every member's prediction on this match (uses
  // predictions_match_idx) — no per-player round trips.
  let preds: {
    user_id: string;
    pred_home: number;
    pred_away: number;
    advance_pick: string | null;
  }[] = [];
  if (userIds.length) {
    const { data } = await db
      .from("predictions")
      .select("user_id, pred_home, pred_away, advance_pick")
      .eq("match_id", match.id)
      .in("user_id", userIds);
    preds = data ?? [];
  }
  const predByUser = new Map(preds.map((p) => [p.user_id, p]));

  const trialActive = isTrialActive();
  // A retired trial reads as locked history regardless of its practice kickoff.
  const state: PredictionState =
    match.is_trial && !trialActive
      ? "locked"
      : predictionState(match.kickoff_at, new Date(), match.is_trial);
  const revealed = state === "locked";

  // A match is "over" the moment the feed reports it finished — we don't wait on
  // the admin confirmation gate to treat it as final.
  const isOver = match.status === "finished" || match.result_confirmed;
  const hasScore = match.home_goals != null && match.away_goals != null;
  // A stale "live" (its window long passed but the finish was never recorded)
  // must not keep showing as live — trial demos use a synthetic clock, so they're
  // exempt from the real-time window guard.
  const isLive =
    !isOver &&
    match.status === "live" &&
    hasScore &&
    (match.is_trial ||
      !liveWindowExpired({ kickoffAt: match.kickoff_at, stage: match.stage }));
  const result =
    isOver && hasScore
      ? {
          home: match.home_goals!,
          away: match.away_goals!,
          advancedCode: match.advanced_code,
        }
      : null;
  const live = isLive
    ? { home: match.home_goals!, away: match.away_goals!, minute: match.minute }
    : null;
  // A scoreline we can grade picks against — the confirmed result, or the live
  // in-play score as a provisional projection (computeBreakdown handles both).
  const scoreline =
    result ??
    (live
      ? { home: live.home, away: live.away, advancedCode: match.advanced_code }
      : null);

  // start_even groups only score matches that kicked off after the group was
  // created; a pre-join member's pick is shown but earns nothing here.
  const lowerBound =
    group.late_join_policy === "start_even"
      ? Date.parse(group.created_at)
      : null;
  const inWindow =
    lowerBound == null || Date.parse(match.kickoff_at) >= lowerBound;
  const counts = inWindow && (!match.is_trial || trialActive);

  const buildRow = (
    userId: string,
    displayName: string,
    pred: { pred_home: number; pred_away: number; advance_pick: string | null } | null,
    isBot: boolean,
  ): MatchBoardRow => {
    const hasPrediction = pred != null;
    // Reveal a pick to its owner is irrelevant here (this is a shared board);
    // reveal to everyone once locked, and always for the deterministic bot.
    const reveal = hasPrediction && (revealed || isBot);
    const pick = reveal
      ? {
          home: pred!.pred_home,
          away: pred!.pred_away,
          advancePick: pred!.advance_pick,
        }
      : null;

    let breakdown: ScoreBreakdown | null = null;
    let points: number | null = null;
    if (pick && scoreline) {
      breakdown = computeBreakdown({
        pick: { home: pick.home, away: pick.away, advancePick: pick.advancePick },
        result: {
          home: scoreline.home,
          away: scoreline.away,
          advancedCode: scoreline.advancedCode,
        },
        stage: match.stage,
        homeCode: match.home_code,
        awayCode: match.away_code,
      });
      // Only counts for the ranking when in the group's window (the bot is the
      // baseline and always counts).
      if (counts || isBot) points = breakdown.total;
    }

    return {
      userId,
      displayName,
      isViewer: userId === opts.viewerId && !isBot,
      isBot,
      hasPrediction,
      pick,
      points,
      breakdown,
      provisional: isLive,
      counts: counts || isBot,
    };
  };

  const rows: MatchBoardRow[] = members.map((m) =>
    buildRow(m.user_id, m.display_name, predByUser.get(m.user_id) ?? null, false),
  );
  // BoringBot: the 0-0 baseline, shown once there's a scoreline to score it on.
  if (revealed && scoreline) {
    rows.push(
      buildRow(
        BORINGBOT_ID,
        BORINGBOT_NAME,
        { pred_home: 0, pred_away: 0, advance_pick: null },
        true,
      ),
    );
  }

  rows.sort((a, b) => {
    if (revealed) {
      // Highest points first; un-scored picks (null) sink to the bottom.
      const ap = a.points ?? -1;
      const bp = b.points ?? -1;
      if (bp !== ap) return bp - ap;
    } else if (a.hasPrediction !== b.hasPrediction) {
      // Pre-kickoff: those who've locked in a pick come first.
      return a.hasPrediction ? -1 : 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return {
    group: { code: group.code, name: group.name },
    match: {
      homeCode: match.home_code,
      awayCode: match.away_code,
      homeLabel: match.home_team,
      awayLabel: match.away_team,
      kickoffAt: match.kickoff_at,
      stage: match.stage,
      groupLabel: match.group_label,
      venue: match.venue,
      trial: Boolean(match.is_trial),
      state,
      result,
      live,
    },
    revealed,
    rows,
    summary: {
      entered: members.filter((m) => predByUser.has(m.user_id)).length,
      total: members.length,
    },
  };
}

export interface BoardMatchSummary {
  id: string;
  stage: Stage;
  groupLabel: string | null;
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  kickoffAt: string;
  state: PredictionState;
  isLive: boolean;
  /** Over per the feed (status finished or an admin confirmation). */
  isFinished: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
}

/**
 * A bounded set of matches to surface on the group page as entry points to
 * their per-match boards: live now, the most recent finished, and the next
 * upcoming — not the whole ~104-match schedule. The retired practice match is
 * left out.
 */
export async function listBoardMatches(
  limitEach = 6,
): Promise<BoardMatchSummary[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("matches")
    .select(
      "id, stage, group_label, home_code, away_code, home_team, away_team, kickoff_at, status, home_goals, away_goals, result_confirmed, is_trial",
    )
    .order("kickoff_at", { ascending: true });
  const now = new Date();
  const all = (data ?? []).filter((m) => !m.is_trial);

  const toSummary = (m: (typeof all)[number]): BoardMatchSummary => ({
    id: m.id,
    stage: m.stage,
    groupLabel: m.group_label,
    homeCode: m.home_code,
    awayCode: m.away_code,
    homeLabel: m.home_team,
    awayLabel: m.away_team,
    kickoffAt: m.kickoff_at,
    state: predictionState(m.kickoff_at, now, false),
    // Mirror the per-match board: a finished/over match is never live, and a
    // stale "live" past its window stops showing as live (these are non-trial).
    isLive:
      !(m.status === "finished" || m.result_confirmed) &&
      m.status === "live" &&
      !liveWindowExpired({ kickoffAt: m.kickoff_at, stage: m.stage }, now),
    isFinished: m.status === "finished" || m.result_confirmed,
    homeGoals: m.home_goals,
    awayGoals: m.away_goals,
  });

  const isLocked = (m: (typeof all)[number]) =>
    predictionState(m.kickoff_at, now, false) === "locked";
  const isFinished = (m: (typeof all)[number]) =>
    m.status === "finished" || m.result_confirmed;
  // In play: kicked off but not yet over — mirrors the profile/predict views so
  // a live match isn't lumped in with finished ones. Over is the feed's finished
  // status (or an admin confirmation), not a wait on confirmation.
  const inPlay = all.filter((m) => isLocked(m) && !isFinished(m));
  const finished = all.filter((m) => isFinished(m));
  const upcoming = all.filter((m) => !isLocked(m));

  // In play first, then most-recent finished, then the soonest upcoming.
  const recent = finished.slice(-limitEach).reverse();
  const next = upcoming.slice(0, limitEach);
  return [...inPlay.reverse(), ...recent, ...next].map(toSummary);
}
