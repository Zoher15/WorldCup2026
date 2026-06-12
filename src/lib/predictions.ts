import { createAdminClient } from "./supabase/admin";
import {
  isWindowOpen,
  isValidGoals,
  predictionState,
  windowOpensAt,
  isTrialActive,
  type PredictionState,
} from "./prediction-rules";
import type { Stage } from "./types";

export interface MatchForPrediction {
  id: string;
  matchNumber: number | null;
  stage: Stage;
  groupLabel: string | null;
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  kickoffAt: string;
  venue: string | null;
  /** When the prediction window opens (ISO). */
  opensAt: string;
  /** upcoming = not open yet, open = editable, locked = kickoff passed. */
  state: PredictionState;
  /** India vs Italy practice match — open immediately, points don't count once the WC starts. */
  isTrial: boolean;
  /** Live match state, so a kicked-off card can show the in-play score next to
   *  the locked-in pick. `status` is 'live' while in play; goals are the score. */
  status: string;
  minute: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface SavedPrediction {
  predHome: number;
  predAway: number;
  advancePick: string | null;
}

export interface PredictionInput {
  matchId: string;
  predHome: number;
  predAway: number;
  advancePick?: string | null;
}

/**
 * Load matches the user can still predict (kickoff in the future), ordered by
 * kickoff, with any predictions they've already made keyed by match id.
 */
export async function getPredictionBoard(userId: string): Promise<{
  matches: MatchForPrediction[];
  predictions: Record<string, SavedPrediction>;
}> {
  const db = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const trialActive = isTrialActive(now);
  // Keep a kicked-off match on the board until its result is confirmed, so a
  // live game stays visible (with locked steppers + the in-play score) instead of
  // vanishing at kickoff. The lower bound drops long-past unconfirmed matches so
  // a data gap can't resurrect ancient fixtures (4h > the longest match window).
  const liveFloorIso = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  // Future + in-play matches: anything not yet confirmed, plus the India–Italy
  // trial (which IS confirmed) so it can run as a live demo during the practice
  // period. Confirmed real matches drop off to the past-predictions page.
  const [matchesRes, predsRes] = await Promise.all([
    db
      .from("matches")
      .select(
        "id, match_number, stage, group_label, home_code, away_code, home_team, away_team, kickoff_at, venue, status, minute, home_goals, away_goals, is_trial",
      )
      .or("result_confirmed.eq.false,is_trial.eq.true")
      .gte("kickoff_at", liveFloorIso)
      .order("kickoff_at", { ascending: true }),
    db
      .from("predictions")
      .select("match_id, pred_home, pred_away, advance_pick")
      .eq("user_id", userId),
  ]);
  const { data: matches, error } = matchesRes;
  if (error) throw new Error(`Could not load matches: ${error.message}`);
  const { data: preds, error: pErr } = predsRes;
  if (pErr) throw new Error(`Could not load your predictions: ${pErr.message}`);

  const predictions: Record<string, SavedPrediction> = {};
  for (const p of preds ?? []) {
    predictions[p.match_id] = {
      predHome: p.pred_home,
      predAway: p.pred_away,
      advancePick: p.advance_pick,
    };
  }

  return {
    matches: (matches ?? [])
      // The trial is editable practice / a live demo until it retires one hour
      // before the tournament, at which point its card disappears entirely.
      .filter((m) => !m.is_trial || trialActive)
      .map((m) => {
        const naturalState = predictionState(m.kickoff_at, now, m.is_trial);
        // Practice match during the warm-up: once you've made a pick, run it as a
        // live demo (its baked-in 2–1 shown as the in-play score) so the live card
        // layout — your call vs the live score, tap for provisional math — is
        // visible right away. Without a pick yet it stays open so you can make one.
        const trialLiveDemo =
          m.is_trial && trialActive && predictions[m.id] != null;
        const state = trialLiveDemo ? "locked" : naturalState;
        return {
          id: m.id,
          matchNumber: m.match_number,
          stage: m.stage,
          groupLabel: m.group_label,
          homeCode: m.home_code,
          awayCode: m.away_code,
          homeLabel: m.home_team,
          awayLabel: m.away_team,
          kickoffAt: m.kickoff_at,
          venue: m.venue,
          opensAt: m.is_trial
            ? nowIso
            : new Date(windowOpensAt(m.kickoff_at)).toISOString(),
          state,
          isTrial: Boolean(m.is_trial),
          status: trialLiveDemo ? "live" : m.status,
          minute: m.minute,
          homeGoals: m.home_goals,
          awayGoals: m.away_goals,
        };
      }),
    predictions,
  };
}

export interface PastPrediction {
  id: string;
  stage: Stage;
  groupLabel: string | null;
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  kickoffAt: string;
  venue: string | null;
  result: { home: number; away: number; advancedCode: string | null };
  pick: { home: number; away: number; advancePick: string | null } | null;
}

/**
 * The viewer's finished (confirmed) matches, newest first, with their pick and
 * the result — the "past predictions" page. Global (predictions belong to the
 * person, not a group), so points here are the raw match points; a group's
 * late-join policy only affects whether they count on that group's board.
 * Once the India–Italy practice match retires it lands here as history (it's a
 * confirmed result); while it's still a live demo on the predictions page it's
 * kept off this page.
 */
export async function getPastPredictionBoard(
  userId: string,
): Promise<PastPrediction[]> {
  const db = createAdminClient();
  const trialActive = isTrialActive();

  const [matchesRes, predsRes] = await Promise.all([
    db
      .from("matches")
      .select(
        "id, stage, group_label, home_code, away_code, home_team, away_team, kickoff_at, venue, status, home_goals, away_goals, advanced_code, is_trial",
      )
      // Finished the moment the feed reports it over — the same rule the group
      // and player-profile views use — rather than waiting on the admin
      // confirmation gate, so a finished match lands here right away.
      .or("status.eq.finished,result_confirmed.eq.true")
      .order("kickoff_at", { ascending: false }),
    db
      .from("predictions")
      .select("match_id, pred_home, pred_away, advance_pick")
      .eq("user_id", userId),
  ]);
  const { data: matches, error } = matchesRes;
  if (error) throw new Error(`Could not load past matches: ${error.message}`);
  if (predsRes.error)
    throw new Error(`Could not load your predictions: ${predsRes.error.message}`);

  const predByMatch = new Map(
    (predsRes.data ?? []).map((p) => [p.match_id, p]),
  );

  return (matches ?? [])
    // The retired practice match shows here as history; while it's still a live
    // demo on the predictions page it's kept off this page.
    .filter(
      (m) =>
        m.home_goals != null &&
        m.away_goals != null &&
        (!m.is_trial || !trialActive),
    )
    .map((m) => {
      const p = predByMatch.get(m.id);
      return {
        id: m.id,
        stage: m.stage,
        groupLabel: m.group_label,
        homeCode: m.home_code,
        awayCode: m.away_code,
        homeLabel: m.home_team,
        awayLabel: m.away_team,
        kickoffAt: m.kickoff_at,
        venue: m.venue,
        result: { home: m.home_goals, away: m.away_goals, advancedCode: m.advanced_code },
        pick: p
          ? { home: p.pred_home, away: p.pred_away, advancePick: p.advance_pick }
          : null,
      };
    });
}

/**
 * Upsert a batch of predictions for a user. Silently skips matches whose
 * prediction window isn't open (not yet open, or kickoff passed — the latter
 * also enforced by a DB trigger) and invalid goals. Returns saved vs skipped.
 */
export async function savePredictions(
  userId: string,
  items: PredictionInput[],
): Promise<{ saved: number; skipped: number }> {
  const db = createAdminClient();

  // Re-check the prediction window server-side against the real kickoffs.
  const ids = items.map((i) => i.matchId);
  const { data: rows } = await db
    .from("matches")
    .select("id, kickoff_at, is_trial")
    .in("id", ids);
  const matchById = new Map(
    (rows ?? []).map((r) => [r.id, { kickoff: r.kickoff_at, isTrial: r.is_trial }]),
  );

  const valid = items.filter((i) => {
    const m = matchById.get(i.matchId);
    return (
      m != null &&
      isWindowOpen(m.kickoff, new Date(), m.isTrial) &&
      isValidGoals(i.predHome, i.predAway)
    );
  });

  if (valid.length > 0) {
    const { error } = await db.from("predictions").upsert(
      valid.map((i) => ({
        user_id: userId,
        match_id: i.matchId,
        pred_home: i.predHome,
        pred_away: i.predAway,
        advance_pick: i.advancePick ?? null,
      })),
      { onConflict: "user_id,match_id" },
    );
    if (error) throw new Error(`Could not save predictions: ${error.message}`);
  }

  return { saved: valid.length, skipped: items.length - valid.length };
}
