import { createAdminClient } from "./supabase/admin";
import type { Stage } from "./types";

export interface AdminMatch {
  id: string;
  matchNumber: number | null;
  stage: Stage;
  groupLabel: string | null;
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  kickoffAt: string;
  homeGoals: number | null;
  awayGoals: number | null;
  advancedCode: string | null;
  resultConfirmed: boolean;
}

export async function getAdminMatches(): Promise<AdminMatch[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("matches")
    .select(
      "id, match_number, stage, group_label, home_code, away_code, home_team, away_team, kickoff_at, home_goals, away_goals, advanced_code, result_confirmed",
    )
    .order("kickoff_at", { ascending: true });
  if (error) throw new Error(`Could not load matches: ${error.message}`);
  return (data ?? []).map((m) => ({
    id: m.id,
    matchNumber: m.match_number,
    stage: m.stage,
    groupLabel: m.group_label,
    homeCode: m.home_code,
    awayCode: m.away_code,
    homeLabel: m.home_team,
    awayLabel: m.away_team,
    kickoffAt: m.kickoff_at,
    homeGoals: m.home_goals,
    awayGoals: m.away_goals,
    advancedCode: m.advanced_code,
    resultConfirmed: m.result_confirmed,
  }));
}

/** Set and confirm a match result. This is the gate that lets points be awarded. */
export async function setMatchResult(opts: {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  advancedCode?: string | null;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("matches")
    .update({
      home_goals: opts.homeGoals,
      away_goals: opts.awayGoals,
      advanced_code: opts.advancedCode ?? null,
      status: "finished",
      result_confirmed: true,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", opts.matchId);
  if (error) throw new Error(`Could not save result: ${error.message}`);
}

/** Revert a match to unplayed (un-confirm a result, e.g. entered by mistake). */
export async function clearMatchResult(matchId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("matches")
    .update({
      home_goals: null,
      away_goals: null,
      advanced_code: null,
      status: "scheduled",
      result_confirmed: false,
    })
    .eq("id", matchId);
  if (error) throw new Error(`Could not clear result: ${error.message}`);
}
