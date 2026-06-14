/**
 * Pure match-day window helpers for the notification emails — no database
 * imports, so they're cheap to unit-test on their own.
 */

import { windowOpensAt } from "./prediction-rules.ts";

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
