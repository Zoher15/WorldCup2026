import { createAdminClient } from "./supabase/admin";
import { isLocked, isValidGoals } from "./prediction-rules";
import type { Stage } from "./types";

export { isLocked, isValidGoals };

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
  locked: boolean;
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

  const { data: matches, error } = await db
    .from("matches")
    .select(
      "id, match_number, stage, group_label, home_code, away_code, home_team, away_team, kickoff_at",
    )
    .gte("kickoff_at", nowIso)
    .order("kickoff_at", { ascending: true });
  if (error) throw new Error(`Could not load matches: ${error.message}`);

  const { data: preds, error: pErr } = await db
    .from("predictions")
    .select("match_id, pred_home, pred_away, advance_pick")
    .eq("user_id", userId);
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
      locked: isLocked(m.kickoff_at),
    })),
    predictions,
  };
}

/**
 * Upsert a batch of predictions for a user. Silently skips matches whose
 * kickoff has passed (also enforced by a DB trigger) and invalid goals.
 * Returns how many were saved vs skipped.
 */
export async function savePredictions(
  userId: string,
  items: PredictionInput[],
): Promise<{ saved: number; skipped: number }> {
  const db = createAdminClient();

  // Re-check lock state server-side against the matches we were given.
  const ids = items.map((i) => i.matchId);
  const { data: rows } = await db
    .from("matches")
    .select("id, kickoff_at")
    .in("id", ids);
  const kickoffById = new Map((rows ?? []).map((r) => [r.id, r.kickoff_at]));

  const valid = items.filter((i) => {
    const ko = kickoffById.get(i.matchId);
    return (
      ko != null && !isLocked(ko) && isValidGoals(i.predHome, i.predAway)
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
