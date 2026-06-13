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

import { scorePrediction, actualWinnerDirection } from "./recompute.ts";
import { scoreMatch, OUTCOME_FOR_CORRECT_DIRECTION } from "./scoring.ts";
import type { LateJoinPolicy, Stage } from "./types.ts";

/** The always-0-0 baseline competitor injected into every group's boards. */
export const BORINGBOT_ID = "boringbot";
export const BORINGBOT_NAME = "BoringBot 🤖";

/** The bot's pick for every match: always 0–0, never an advance call. */
export const BORINGBOT_PICK: {
  pred_home: number;
  pred_away: number;
  advance_pick: string | null;
} = { pred_home: 0, pred_away: 0, advance_pick: null };

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
  homeCode: string | null;
  awayCode: string | null;
  /** Practice (India vs Italy) match — only counts before the tournament starts. */
  isTrial?: boolean;
  /** An in-play / just-finished score to count provisionally, before the result
   *  is officially confirmed. Graded the same as a confirmed result; the board
   *  re-settles when confirmation lands (which the auto-confirm does at FT). */
  live?: boolean;
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
  /** Consecutive most-recent settled matches where the player called the
   *  direction (right winner or right draw); a wrong/one-step-off call breaks
   *  it, however close the scoreline (trial and out-of-window matches excluded).
   *  Optional so synthetic boards (the home-page demo) can omit it. */
  streak?: number;
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
  streak: number;
}

/** Standard competition ranking (1, 1, 3) over rows already sorted by points
 *  descending: everyone on the same points shares a rank — ten people tied for
 *  2nd are ALL "=2", not 2 through 11. */
export function competitionRanks(rows: readonly { points: number }[]): number[] {
  const ranks: number[] = [];
  rows.forEach((r, i) => {
    ranks[i] = i > 0 && rows[i - 1].points === r.points ? ranks[i - 1] : i + 1;
  });
  return ranks;
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
      streak: t.streak,
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
  /** Whether the practice (trial) match still counts (pre-tournament only). */
  countTrialMatches?: boolean;
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
      streak: 0,
    });
  }

  // Pair each match with its parsed kickoff so start_even filtering doesn't
  // re-parse the same date once per prediction.
  const matchById = new Map(
    matches.map((m) => [m.id, { match: m, kickoffMs: Date.parse(m.kickoffAt) }]),
  );
  const lowerBound =
    lateJoinPolicy === "start_even" ? Date.parse(groupCreatedAt) : null;

  // A match counts toward the boards unless it kicked off before a start_even
  // group was created, or it's the trial match after the tournament has begun.
  const counts = (match: StandingMatch, kickoffMs: number): boolean => {
    if (lowerBound != null && kickoffMs < lowerBound) return false;
    if (match.isTrial && !input.countTrialMatches) return false;
    return true;
  };

  // Per-user OUTCOME points on SETTLED (confirmed) matches, kept aside for the
  // streak walk below — the streak tracks correct *directions*, so it keys off
  // outcome points (5 = right winner/draw), not the total. Provisional live
  // scores don't move a streak, so it can't flip-flop mid-match.
  const settledOutcome = new Map<string, Map<string, number>>();
  const recordSettled = (userId: string, matchId: string, outcome: number) => {
    let byMatch = settledOutcome.get(userId);
    if (!byMatch) settledOutcome.set(userId, (byMatch = new Map()));
    byMatch.set(matchId, outcome);
  };

  for (const p of predictions) {
    const agg = totals.get(p.userId);
    if (!agg) continue; // prediction by a non-member of this group
    const entry = matchById.get(p.matchId);
    if (!entry) continue;
    const { match, kickoffMs } = entry;
    if (!counts(match, kickoffMs)) continue;

    // A live (in-play) score counts provisionally: grade it as if confirmed so
    // the board moves with the match, then it re-settles when the result lands.
    const gradable = match.live ? { ...match, resultConfirmed: true } : match;
    const score = scorePrediction(
      {
        id: "",
        predHome: p.predHome,
        predAway: p.predAway,
        advancePick: p.advancePick,
      },
      gradable,
    );
    if (!score) continue; // match not scorable yet

    agg.total += score.totalPoints;
    agg.outcome += score.outcomePoints + score.advancePoints;
    agg.closeness += score.closenessPoints;
    if (match.resultConfirmed) recordSettled(p.userId, match.id, score.outcomePoints);
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
      streak: 0,
    };
    for (const { match, kickoffMs } of matchById.values()) {
      if (!counts(match, kickoffMs)) continue;
      if (
        (!match.resultConfirmed && !match.live) ||
        match.homeGoals == null ||
        match.awayGoals == null
      ) {
        continue;
      }
      const { outcome, closeness } = scoreMatch(
        { homeGoals: BORINGBOT_PICK.pred_home, awayGoals: BORINGBOT_PICK.pred_away },
        { homeGoals: match.homeGoals, awayGoals: match.awayGoals },
        actualWinnerDirection(match),
      );
      bot.outcome += outcome;
      bot.closeness += closeness;
      bot.total += outcome + closeness;
      if (match.resultConfirmed) {
        recordSettled(BORINGBOT_ID, match.id, outcome);
      }
    }
    list.push(bot);
  }

  // Streaks: walk the settled, counted matches newest-first; counting how many
  // in a row the player called the direction on (outcome === 5). A miss, a
  // one-step-off call, or no pick breaks the run — a close-but-wrong scoreline
  // doesn't keep it alive. The trial never counts here (counts() excludes it
  // once retired).
  const settledDesc = [...matchById.values()]
    .filter(
      ({ match, kickoffMs }) =>
        counts(match, kickoffMs) &&
        match.resultConfirmed &&
        match.homeGoals != null &&
        match.awayGoals != null,
    )
    .sort((a, b) => b.kickoffMs - a.kickoffMs);
  for (const t of list) {
    const byMatch = settledOutcome.get(t.userId);
    for (const { match } of settledDesc) {
      const outcome = byMatch?.get(match.id);
      if (outcome == null || outcome < OUTCOME_FOR_CORRECT_DIRECTION) break;
      t.streak++;
    }
  }

  return {
    overall: rank(list, (t) => t.total),
    win: rank(list, (t) => t.outcome),
    scoreline: rank(list, (t) => t.closeness),
  };
}
