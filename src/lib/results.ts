import { createAdminClient } from "./supabase/admin";
import { isValidAdvanceCode } from "./prediction-rules";
import { teamByCode } from "./fifa";
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
  const { data: match } = await db
    .from("matches")
    .select("stage, home_code, away_code, home_team, away_team")
    .eq("id", opts.matchId)
    .single();
  if (!match) throw new Error("Match not found.");

  // A confirmed result is never overwritten by the feed sync, so a mistyped
  // advanced-team code would be locked in — and silently cost everyone who
  // picked the real team their advance bonus. Check it against the match.
  if (opts.advancedCode != null) {
    const m = {
      stage: match.stage,
      homeCode: match.home_code,
      awayCode: match.away_code,
    };
    if (!isValidAdvanceCode(opts.advancedCode, m)) {
      throw new Error(
        `Advanced team must be one of the match's teams (${m.homeCode ?? "?"} or ${m.awayCode ?? "?"}).`,
      );
    }
  }

  const update: Record<string, unknown> = {
    home_goals: opts.homeGoals,
    away_goals: opts.awayGoals,
    advanced_code: opts.advancedCode ?? null,
    status: "finished",
    result_confirmed: true,
    last_synced_at: new Date().toISOString(),
  };
  // Keep the stored team names in lockstep with the codes as we lock the result:
  // the feed fills a knockout's codes but leaves the seed's "Winner of Match N"
  // placeholder in home_team/away_team, so refresh them from the codes here so a
  // confirmed match never carries a stale label. (Confirmed matches are skipped
  // by the sync, so this is the last chance to tidy them.)
  const homeName = teamByCode(match.home_code)?.name;
  const awayName = teamByCode(match.away_code)?.name;
  if (homeName && homeName !== match.home_team) update.home_team = homeName;
  if (awayName && awayName !== match.away_team) update.away_team = awayName;

  const { error } = await db
    .from("matches")
    .update(update)
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
