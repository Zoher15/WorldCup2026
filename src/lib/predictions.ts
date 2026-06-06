import { createAdminClient } from "./supabase/admin";
import {
  isWindowOpen,
  isValidGoals,
  predictionState,
  windowOpensAt,
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
  /** When the prediction window opens (ISO). */
  opensAt: string;
  /** upcoming = not open yet, open = editable, locked = kickoff passed. */
  state: PredictionState;
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
  const nowIso = new Date().toISOString();

  // Upcoming matches and the user's existing predictions are independent.
  const [matchesRes, predsRes] = await Promise.all([
    db
      .from("matches")
      .select(
        "id, match_number, stage, group_label, home_code, away_code, home_team, away_team, kickoff_at",
      )
      .gte("kickoff_at", nowIso)
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
    matches: (matches ?? []).map((m) => ({
      id: m.id,
      matchNumber: m.match_number,
      stage: m.stage,
      groupLabel: m.group_label,
      homeCode: m.home_code,
      awayCode: m.away_code,
      homeLabel: m.home_team,
      awayLabel: m.away_team,
      kickoffAt: m.kickoff_at,
      opensAt: new Date(windowOpensAt(m.kickoff_at)).toISOString(),
      state: predictionState(m.kickoff_at),
    })),
    predictions,
  };
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
    .select("id, kickoff_at")
    .in("id", ids);
  const kickoffById = new Map((rows ?? []).map((r) => [r.id, r.kickoff_at]));

  const valid = items.filter((i) => {
    const ko = kickoffById.get(i.matchId);
    return (
      ko != null && isWindowOpen(ko) && isValidGoals(i.predHome, i.predAway)
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
