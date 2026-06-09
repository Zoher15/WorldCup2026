/**
 * Pure leaderboard aggregation: turn raw predictions + confirmed results into
 * the three ranked boards (overall / win / scoreline) for a group.
 *
 * Honors the group's late-join policy:
 *   - carry_over: every locked prediction counts, regardless of when the member
 *     joined (rewards predicting early).
 *   - start_even: only matches that kicked off at/after the group was created
 *     count, so the whole group is scored over the same window.
 *
 * No database imports — fed already-loaded rows so it's easy to unit-test.
 */

import { scorePrediction } from "./recompute.ts";
import { scoreMatch } from "./scoring.ts";
import type { LateJoinPolicy, Stage } from "./types.ts";

/** The always-0-0 baseline competitor injected into every group's boards. */
export const BORINGBOT_ID = "boringbot";
export const BORINGBOT_NAME = "BoringBot 🤖";

export interface StandingMember {
  userId: string;
  displayName: string;
  joinedAt: string;
}

export interface StandingMatch {
  id: string;
  kickoffAt: string;
  stage: Stage;
  resultConfirmed: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  advancedCode: string | null;
}

export interface StandingPrediction {
  userId: string;
  matchId: string;
  predHome: number;
  predAway: number;
  advancePick: string | null;
}

export interface StandingsRow {
  userId: string;
  displayName: string;
  points: number;
  movement: number;
}

export interface Standings {
  overall: StandingsRow[];
  win: StandingsRow[];
  scoreline: StandingsRow[];
}

interface Totals {
  userId: string;
  displayName: string;
  total: number;
  outcome: number;
  closeness: number;
}

function rank(
  totals: Totals[],
  pick: (t: Totals) => number,
): StandingsRow[] {
  return totals
    .map((t) => ({
      userId: t.userId,
      displayName: t.displayName,
      points: pick(t),
      movement: 0,
    }))
    .sort(
      (a, b) =>
        b.points - a.points || a.displayName.localeCompare(b.displayName),
    );
}

export function buildStandings(input: {
  members: StandingMember[];
  matches: StandingMatch[];
  predictions: StandingPrediction[];
  lateJoinPolicy: LateJoinPolicy;
  groupCreatedAt: string;
  /** Add the BoringBot 0-0 baseline competitor to every board. */
  includeBaseline?: boolean;
}): Standings {
  const { members, matches, predictions, lateJoinPolicy, groupCreatedAt } = input;

  const totals = new Map<string, Totals>();
  for (const m of members) {
    totals.set(m.userId, {
      userId: m.userId,
      displayName: m.displayName,
      total: 0,
      outcome: 0,
      closeness: 0,
    });
  }

  // Pair each match with its parsed kickoff so start_even filtering doesn't
  // re-parse the same date once per prediction.
  const matchById = new Map(
    matches.map((m) => [m.id, { match: m, kickoffMs: Date.parse(m.kickoffAt) }]),
  );
  const lowerBound =
    lateJoinPolicy === "start_even" ? Date.parse(groupCreatedAt) : null;

  for (const p of predictions) {
    const agg = totals.get(p.userId);
    if (!agg) continue; // prediction by a non-member of this group
    const entry = matchById.get(p.matchId);
    if (!entry) continue;
    const { match, kickoffMs } = entry;
    if (lowerBound != null && kickoffMs < lowerBound) continue;

    const score = scorePrediction(
      {
        id: "",
        predHome: p.predHome,
        predAway: p.predAway,
        advancePick: p.advancePick,
      },
      match,
    );
    if (!score) continue; // match not scorable yet

    agg.total += score.totalPoints;
    agg.outcome += score.outcomePoints + score.advancePoints;
    agg.closeness += score.closenessPoints;
  }

  const list = [...totals.values()];

  // BoringBot: the baseline that "predicts" 0-0 on every scorable match in the
  // group's window. Scored by the same engine so members can see if they're
  // beating the bot. No advance picks, so it earns no knockout bonus.
  if (input.includeBaseline) {
    const bot: Totals = {
      userId: BORINGBOT_ID,
      displayName: BORINGBOT_NAME,
      total: 0,
      outcome: 0,
      closeness: 0,
    };
    for (const { match, kickoffMs } of matchById.values()) {
      if (lowerBound != null && kickoffMs < lowerBound) continue;
      if (
        !match.resultConfirmed ||
        match.homeGoals == null ||
        match.awayGoals == null
      ) {
        continue;
      }
      const { outcome, closeness } = scoreMatch(
        { homeGoals: 0, awayGoals: 0 },
        { homeGoals: match.homeGoals, awayGoals: match.awayGoals },
      );
      bot.outcome += outcome;
      bot.closeness += closeness;
      bot.total += outcome + closeness;
    }
    list.push(bot);
  }

  return {
    overall: rank(list, (t) => t.total),
    win: rank(list, (t) => t.outcome),
    scoreline: rank(list, (t) => t.closeness),
  };
}
