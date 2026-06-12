import { createAdminClient } from "./supabase/admin";
import { normalizeCode } from "./codes";
import { deriveMatchScore, mapMatchFields } from "./match-status";
import {
  predictionState,
  isTrialActive,
  type PredictionState,
} from "./prediction-rules";
import { scorePrediction } from "./recompute";
import { BORINGBOT_ID, BORINGBOT_NAME, BORINGBOT_PICK } from "./standings";
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
  /** In-play (unconfirmed) score while the match is live; null otherwise. */
  live: { home: number; away: number; minute: number | null } | null;
  /** Points earned, when scored and counted under the group's policy. */
  points: number | null;
  /** India vs Italy practice match — shown as history, excluded from badges. */
  isTrial: boolean;
}

export interface PlayerProfile {
  group: { code: string; name: string };
  player: {
    displayName: string;
    /** The player's real name (from their profile). null for the bot, or when
     *  it's identical to the display name (nothing extra worth showing). */
    realName: string | null;
    /** The player's sign-in email (from Supabase Auth). null for the bot. */
    email: string | null;
    isViewer: boolean;
    isBot: boolean;
  };
  rows: PlayerPredictionRow[];
  summary: { predicted: number; total: number; points: number };
}

type StoredPrediction = {
  pred_home: number;
  pred_away: number;
  advance_pick: string | null;
};

export interface PlayerBadges {
  /** Consecutive most-recent finished matches scoring > 0 points. */
  streak: number;
  /** Finished matches where the pick equals the result exactly. */
  exact: number;
  /** The matches behind each badge (most recent first), so a tapped chip can
   *  link straight to those cards on the past-results page. */
  streakMatchIds: string[];
  exactMatchIds: string[];
}

/**
 * Derive the profile's badge chips from rows already in hand — pure, no extra
 * queries. Rows arrive kickoff-ascending (see getPlayerProfile's match query),
 * so "most recent" walks backwards from the end; a finished match is one with
 * a result, and its pick is always revealed, so this works for any player.
 * A finished match with no points (no pick, scored 0, or outside the group's
 * window) breaks the streak. The retired practice match never counts.
 */
export function derivePlayerBadges(rows: PlayerPredictionRow[]): PlayerBadges {
  const finished = rows.filter((r) => r.result != null && !r.isTrial);
  const streakMatchIds: string[] = [];
  for (let i = finished.length - 1; i >= 0; i--) {
    const p = finished[i].points;
    if (p == null || p <= 0) break;
    streakMatchIds.push(finished[i].matchId);
  }
  const exactMatchIds: string[] = [];
  for (let i = finished.length - 1; i >= 0; i--) {
    const r = finished[i];
    if (
      r.pick &&
      r.result &&
      r.pick.home === r.result.home &&
      r.pick.away === r.result.away
    ) {
      exactMatchIds.push(r.matchId);
    }
  }
  return {
    streak: streakMatchIds.length,
    exact: exactMatchIds.length,
    streakMatchIds,
    exactMatchIds,
  };
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

  // BoringBot is a synthetic baseline (always predicts 0–0), not a real
  // membership. Everyone else must belong to THIS group (which also yields
  // their per-group display name).
  const isBot = opts.userId === BORINGBOT_ID;
  let displayName: string;
  let realName: string | null = null;
  let email: string | null = null;
  if (isBot) {
    displayName = BORINGBOT_NAME;
  } else {
    // Fetch the per-group alias, the user's real name, and their sign-in email
    // together. The alias (display_name) is what the leaderboard shows; the real
    // name (users.real_name, set at signup) and email (from Supabase Auth) are
    // surfaced on the profile so group-mates know who's who.
    const [membershipRes, userRes, authRes] = await Promise.all([
      db
        .from("memberships")
        .select("display_name")
        .eq("group_id", group.id)
        .eq("user_id", opts.userId)
        .single(),
      db.from("users").select("real_name").eq("id", opts.userId).single(),
      db.auth.admin.getUserById(opts.userId),
    ]);
    if (!membershipRes.data) return null;
    displayName = membershipRes.data.display_name;
    const real = userRes.data?.real_name?.trim() ?? "";
    // Only worth showing when it adds information beyond the display name.
    realName = real && real !== displayName ? real : null;
    email = authRes.data?.user?.email ?? null;
  }

  const [matchesRes, predsRes] = await Promise.all([
    db
      .from("matches")
      .select(
        "id, match_number, stage, group_label, home_code, away_code, home_team, away_team, kickoff_at, venue, status, minute, home_goals, away_goals, advanced_code, result_confirmed, is_trial",
      )
      .order("kickoff_at", { ascending: true }),
    isBot
      ? Promise.resolve({ data: [] as { match_id: string }[] })
      : db
          .from("predictions")
          .select("match_id, pred_home, pred_away, advance_pick")
          .eq("user_id", opts.userId),
  ]);
  // The retired practice match stays on the profile as history — a finished
  // match showing the pick and result — but no longer counts (see countTrial).
  const trialActive = isTrialActive();
  const matches = matchesRes.data ?? [];
  const predByMatch = new Map(
    (predsRes.data ?? []).map((p) => [p.match_id, p as StoredPrediction & { match_id: string }]),
  );
  const isViewer = opts.viewerId === opts.userId && !isBot;
  const lowerBound =
    group.late_join_policy === "start_even" ? Date.parse(group.created_at) : null;
  const countTrial = trialActive;

  let predicted = 0;
  let points = 0;
  const rows: PlayerPredictionRow[] = matches.map((m) => {
    // A retired trial renders as a finished match (locked → pick revealed,
    // result shown), regardless of its scheduled practice kickoff.
    const state =
      m.is_trial && !trialActive
        ? "locked"
        : predictionState(m.kickoff_at, new Date(), m.is_trial);
    // BoringBot's pick is the same 0–0 for every match.
    const pred: StoredPrediction | undefined = isBot
      ? BORINGBOT_PICK
      : predByMatch.get(m.id);
    const hasPrediction = pred != null;
    if (hasPrediction) predicted++;

    // Reveal the pick to the owner, once the match has kicked off, or always for
    // BoringBot (its 0–0 is public and deterministic).
    const reveal = hasPrediction && (isBot || isViewer || state === "locked");
    const pick = reveal
      ? { home: pred!.pred_home, away: pred!.pred_away, advancePick: pred!.advance_pick }
      : null;

    // Over the moment the feed reports it finished (no waiting on the admin
    // confirmation gate), so a finished match moves to past results — with its
    // score and points — right away. `live` is the in-play score otherwise.
    const { result, live } = deriveMatchScore(m);

    // Points count once the match is over and it falls within the group's
    // scoring window — graded against the final score the feed reported, without
    // waiting on the admin gate (which only governs the official leaderboard).
    let rowPoints: number | null = null;
    const inWindow = lowerBound == null || Date.parse(m.kickoff_at) >= lowerBound;
    const counts = inWindow && (!m.is_trial || countTrial);
    if (hasPrediction && counts && result) {
      const score = scorePrediction(
        {
          id: "",
          predHome: pred!.pred_home,
          predAway: pred!.pred_away,
          advancePick: pred!.advance_pick,
        },
        {
          resultConfirmed: true,
          homeGoals: m.home_goals,
          awayGoals: m.away_goals,
          stage: m.stage,
          advancedCode: m.advanced_code,
          homeCode: m.home_code,
          awayCode: m.away_code,
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
      ...mapMatchFields(m),
      state,
      hasPrediction,
      pick,
      result,
      live,
      points: rowPoints,
      isTrial: Boolean(m.is_trial),
    };
  });

  return {
    group: { code: group.code, name: group.name },
    player: { displayName, realName, email, isViewer, isBot },
    rows,
    summary: { predicted, total: matches.length, points },
  };
}
