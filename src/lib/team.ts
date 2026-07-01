/**
 * A country's fixtures across the tournament — the same match a player predicts,
 * viewed from a team's side instead of a person's. Every match this team plays
 * (or is already slotted into), split by where it sits relative to its
 * prediction window, with the confirmed result / in-play score and a running
 * win–draw–loss record. Predictions are global, so this is group-agnostic; each
 * card deep-links to the per-match hub where the picks live.
 */

import { createAdminClient } from "./supabase/admin";
import { deriveMatchScore, mapMatchFields } from "./match-status";
import { liveWindowExpired } from "./polling";
import { predictionState, roundOpensByStage, type PredictionState } from "./prediction-rules";
import { teamByCode } from "./fifa";
import { teamOutcome, type TeamOutcome } from "./team-outcome";
import type { Stage } from "./types";

export type { TeamOutcome };

export interface TeamMatchRow {
  matchId: string;
  matchNumber: number | null;
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  kickoffAt: string;
  stage: Stage;
  groupLabel: string | null;
  venue: string | null;
  state: PredictionState;
  /** The confirmed full-time result, when available. */
  result: { home: number; away: number; advancedCode: string | null } | null;
  /** In-play (unconfirmed) score while the match is live; null otherwise. */
  live: { home: number; away: number; minute: number | null } | null;
  /** Whether this team is the home side in the fixture. */
  isHome: boolean;
  /** This team's result once the match is over (penalties settle a knockout). */
  outcome: TeamOutcome | null;
}

export interface TeamRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TeamSchedule {
  team: {
    code: string;
    name: string;
    /** flag-icons ISO code, for the flag. */
    iso: string;
    /** Representative flag colour (hex). */
    color: string;
    /** The team's group letter, from its group-stage fixtures. */
    groupLabel: string | null;
  };
  rows: TeamMatchRow[];
  record: TeamRecord;
}

/**
 * A country's full schedule: every non-practice match it plays, in kickoff
 * order, with each match's window state, result/live score, and this team's
 * outcome, plus a rolled-up win–draw–loss record. Returns null for an unknown
 * FIFA code so the page can 404.
 */
export async function getTeamSchedule(codeInput: string): Promise<TeamSchedule | null> {
  const code = codeInput.toUpperCase();
  const info = teamByCode(code);
  if (!info) return null;

  const db = createAdminClient();
  const { data } = await db
    .from("matches")
    .select(
      "id, match_number, stage, group_label, home_code, away_code, home_team, away_team, kickoff_at, venue, status, minute, home_goals, away_goals, advanced_code, result_confirmed, is_trial",
    )
    // The FIFA code is validated above (teamByCode), so it's a safe literal here.
    .or(`home_code.eq.${code},away_code.eq.${code}`)
    .order("kickoff_at", { ascending: true });

  // The India vs Italy practice match is left out — it isn't a real fixture.
  const matches = (data ?? []).filter((m) => !m.is_trial);

  // Knockout rounds open together: anchor each knockout game's state to its
  // round's shared open instant rather than its own day-before window.
  const roundOpens = roundOpensByStage(
    matches.map((m) => ({ stage: m.stage, kickoffAt: m.kickoff_at })),
  );
  const now = new Date();

  const rows: TeamMatchRow[] = matches.map((m) => {
    const state = predictionState(m.kickoff_at, now, false, roundOpens.get(m.stage));
    // A stale "live" past its window stops showing as live (mirrors the boards).
    const { result, live } = deriveMatchScore(m, {
      liveAllowed: !liveWindowExpired({ kickoffAt: m.kickoff_at, stage: m.stage }, now),
    });
    const isHome = m.home_code === code;
    return {
      matchId: m.id,
      matchNumber: m.match_number,
      ...mapMatchFields(m),
      state,
      result,
      live,
      isHome,
      outcome: result ? teamOutcome(result, isHome, code, m.stage) : null,
    };
  });

  const record: TeamRecord = { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const r of rows) {
    if (!r.result) continue;
    record.played++;
    record.goalsFor += r.isHome ? r.result.home : r.result.away;
    record.goalsAgainst += r.isHome ? r.result.away : r.result.home;
    if (r.outcome === "W") record.wins++;
    else if (r.outcome === "D") record.draws++;
    else record.losses++;
  }

  // The group letter comes from the team's group-stage fixtures.
  const groupLabel = rows.find((r) => r.stage === "group")?.groupLabel ?? null;

  return {
    team: { code, name: info.name, iso: info.iso, color: info.color, groupLabel },
    rows,
    record,
  };
}

export interface TeamListItem {
  code: string;
  name: string;
  iso: string;
}

export interface TeamGroupList {
  label: string;
  teams: TeamListItem[];
}

/**
 * Every team in the field, bucketed by group letter (A–L) and sorted by name —
 * the browsable index behind the teams page. Built from the group-stage
 * fixtures, so it reflects whoever's actually slotted into each group.
 */
export async function listTeamGroups(): Promise<TeamGroupList[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("matches")
    .select("group_label, home_code, away_code, is_trial")
    .eq("stage", "group");

  const byGroup = new Map<string, Set<string>>();
  for (const m of data ?? []) {
    if (m.is_trial || !m.group_label) continue;
    const set = byGroup.get(m.group_label) ?? new Set<string>();
    if (m.home_code) set.add(m.home_code);
    if (m.away_code) set.add(m.away_code);
    byGroup.set(m.group_label, set);
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, codes]) => ({
      label,
      teams: [...codes]
        .map((code) => {
          const t = teamByCode(code);
          return t ? { code, name: t.name, iso: t.iso } : null;
        })
        .filter((t): t is TeamListItem => t != null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
