/**
 * Pure match-day window helpers for the notification emails — no database
 * imports, so they're cheap to unit-test on their own.
 */

import {
  windowOpensAt,
  roundOpensByStage,
  KNOCKOUT_STAGES,
} from "./prediction-rules.ts";
import type { Stage } from "./types.ts";

export interface MatchDayGroup<T> {
  /** When the match-day's prediction window opened (epoch ms). */
  opensAt: number;
  /** The window-open instant as ISO — the match-day's id in the send logs. */
  matchDay: string;
  matches: T[];
}

/** Group matches by the instant their match-day opened, earliest-opening first. */
export function groupMatchDays<T extends { kickoff_at: string }>(
  matches: T[],
): MatchDayGroup<T>[] {
  const byOpen = new Map<number, T[]>();
  for (const m of matches) {
    const opensAt = windowOpensAt(m.kickoff_at);
    const arr = byOpen.get(opensAt);
    if (arr) arr.push(m);
    else byOpen.set(opensAt, [m]);
  }
  return [...byOpen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([opensAt, group]) => ({
      opensAt,
      matchDay: new Date(opensAt).toISOString(),
      matches: group,
    }));
}

/**
 * Match-days whose FIRST kickoff is within `leadMs` ahead of `now` — i.e. the
 * day is about to begin (earliestKickoff − lead ≤ now < earliestKickoff).
 * Drives the once-per-match-day digest, fired ~an hour before the day's opening
 * game (by which point members have had the full prediction window to play, so
 * the "still missing" and FOMO counts are meaningful). A day whose first kickoff
 * has already passed is excluded (the day is underway, not pending). Earliest
 * first; the `matchDay` id is still the window-open instant, so it keys the
 * exactly-once send claim regardless of when the digest actually goes out.
 */
export function dueMatchDaysForDigest<T extends { kickoff_at: string }>(
  matches: T[],
  now: Date,
  leadMs: number,
): MatchDayGroup<T>[] {
  const nowMs = now.getTime();
  return groupMatchDays(matches).filter((d) => {
    const earliestKickoff = Math.min(
      ...d.matches.map((m) => Date.parse(m.kickoff_at)),
    );
    return earliestKickoff - leadMs <= nowMs && nowMs < earliestKickoff;
  });
}

export interface RoundOpenGroup<T> {
  stage: Stage;
  /** When the whole round opened for prediction (epoch ms). */
  opensAt: number;
  matches: T[];
}

/**
 * Knockout rounds ready to ANNOUNCE: a round qualifies the moment its (shared)
 * prediction window has opened and its bracket is fully resolved, but before its
 * first game kicks off —
 *
 *   opensAt ≤ now < firstKickoff, and every game in the round has both teams.
 *
 * Drives the one-per-round "the round is open" broadcast. The bracket guard
 * avoids announcing a round still showing "Winner of …" placeholders (the prior
 * round's last game can finish after the window technically opens), and the
 * first-kickoff guard means deploying mid-round can't blast a round already
 * underway. Returns one group per due round (games kickoff-ascending), earliest
 * round first; the caller claims each exactly once.
 */
export function dueRoundOpens<
  T extends {
    stage: Stage;
    kickoff_at: string;
    home_code: string | null;
    away_code: string | null;
  },
>(matches: T[], now: Date): RoundOpenGroup<T>[] {
  const nowMs = now.getTime();
  const opens = roundOpensByStage(
    matches.map((m) => ({ stage: m.stage, kickoffAt: m.kickoff_at })),
  );
  const byStage = new Map<Stage, T[]>();
  for (const m of matches) {
    if (!KNOCKOUT_STAGES.has(m.stage)) continue;
    const arr = byStage.get(m.stage);
    if (arr) arr.push(m);
    else byStage.set(m.stage, [m]);
  }
  const due: RoundOpenGroup<T>[] = [];
  for (const [stage, group] of byStage) {
    const opensAt = opens.get(stage);
    if (opensAt == null) continue;
    const firstKickoff = Math.min(...group.map((m) => Date.parse(m.kickoff_at)));
    const bracketSet = group.every((m) => m.home_code && m.away_code);
    if (opensAt <= nowMs && nowMs < firstKickoff && bracketSet) {
      due.push({
        stage,
        opensAt,
        matches: [...group].sort(
          (a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at),
        ),
      });
    }
  }
  return due.sort((a, b) => a.opensAt - b.opensAt);
}
