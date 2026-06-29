/**
 * Pure logic for syncing football-data.org matches into our matches — no
 * network or DB, so it's unit-testable. Mirrors sync-core but for the
 * football-data schema.
 */

import type { FdMatch, FdSideScore } from "./footballdata.ts";
import type { LocalMatchRef, MatchStatus, MatchUpdate } from "./types.ts";

const FINAL = new Set(["FINISHED", "AWARDED"]);
const LIVE = new Set(["IN_PLAY", "PAUSED"]);

type ResolveTeam = (tla: string | null, name: string) => string | null;

/** A finished, points-awarding status. */
export function isFdFinal(status: string): boolean {
  return FINAL.has(status);
}

/** Map a football-data status to our match status. */
export function fdStatusToOurs(status: string): MatchStatus {
  if (FINAL.has(status)) return "finished";
  if (LIVE.has(status)) return "live";
  if (status === "POSTPONED" || status === "SUSPENDED") return "postponed";
  if (status === "CANCELLED") return "cancelled";
  return "scheduled";
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/** Find which local match a football-data match corresponds to. */
export function matchFdToLocal(
  m: FdMatch,
  locals: LocalMatchRef[],
  resolveTeam: ResolveTeam,
  toleranceMs: number = 3 * 60 * 60 * 1000,
): string | null {
  const apiMs = Date.parse(m.utcDate);
  if (Number.isNaN(apiMs)) return null;

  const near = locals.filter(
    (l) => Math.abs(Date.parse(l.kickoffAt) - apiMs) <= toleranceMs,
  );
  if (near.length === 1) return near[0].id;
  if (near.length === 0) return null;

  const hc = resolveTeam(m.homeTeam.tla, m.homeTeam.name);
  const ac = resolveTeam(m.awayTeam.tla, m.awayTeam.name);
  if (hc && ac) {
    const want = new Set([hc, ac]);
    const exact = near.find(
      (l) =>
        l.homeCode &&
        l.awayCode &&
        sameSet(new Set([l.homeCode, l.awayCode]), want),
    );
    if (exact) return exact.id;
  }
  return null;
}

/** Read a football-data side-score, tolerating either the v4 `home`/`away` keys
 *  or the `homeTeam`/`awayTeam` shape. Returns nulls when the block is absent. */
function side(s: FdSideScore | null | undefined): { home: number | null; away: number | null } {
  if (!s) return { home: null, away: null };
  return { home: s.home ?? s.homeTeam ?? null, away: s.away ?? s.awayTeam ?? null };
}

/**
 * The on-pitch scoreline to grade closeness against: the score at the end of 90
 * + extra time, EXCLUDING any penalty shootout. A tie settled on penalties is
 * graded as the level draw it was on the pitch; the shootout result rides
 * separately via `winner` -> `advancedCode`.
 *
 * football-data's `fullTime` is the FINAL score and, for a penalty win, folds
 * the shootout in (a 1-1 won 6-5 on pens is reported as 7-6) — so we must NOT
 * use it directly or the post-shootout score leaks into closeness. We recover
 * the end-of-extra-time score defensively, never trusting a single field:
 *
 *   1. fullTime − penalties, whenever a shootout tally is present and the
 *      subtraction stays non-negative (the usual case: fullTime includes pens).
 *      This is independent of how `duration` is spelled, so a renamed status
 *      can't let the shootout through.
 *   2. else regularTime (+ extraTime) — the clean components, used when a feed
 *      reports those instead (or when fullTime already EXCLUDED the shootout, so
 *      subtracting would have gone negative and step 1 was skipped).
 *   3. else fullTime as-is (regular-time finishes, where it's the real score).
 */
function endOfPlayScoreline(
  score: FdMatch["score"],
): { home: number | null; away: number | null } {
  const full = side(score.fullTime);
  const pens = side(score.penalties);

  // 1. Peel a penalty shootout back out of the final score.
  if (full.home != null && full.away != null && pens.home != null && pens.away != null) {
    const h = full.home - pens.home;
    const a = full.away - pens.away;
    if (h >= 0 && a >= 0) return { home: h, away: a };
  }

  // 2. Rebuild from the clean components when they're provided.
  const reg = side(score.regularTime);
  if (reg.home != null && reg.away != null) {
    const et = side(score.extraTime);
    return { home: reg.home + (et.home ?? 0), away: reg.away + (et.away ?? 0) };
  }

  // 3. No shootout, no components: the final score is the on-pitch score.
  return full;
}

/** Derive the fields to write for a match from its football-data record. */
export function deriveFdUpdate(
  m: FdMatch,
  opts: { isKnockout: boolean; resolveTeam: ResolveTeam },
): MatchUpdate {
  const final = isFdFinal(m.status);
  const homeCode = opts.resolveTeam(m.homeTeam.tla, m.homeTeam.name);
  const awayCode = opts.resolveTeam(m.awayTeam.tla, m.awayTeam.name);

  let advancedCode: string | null = null;
  if (final && opts.isKnockout) {
    if (m.score.winner === "HOME_TEAM") advancedCode = homeCode;
    else if (m.score.winner === "AWAY_TEAM") advancedCode = awayCode;
  }

  const scoreline = endOfPlayScoreline(m.score);

  return {
    status: fdStatusToOurs(m.status),
    minute: null, // football-data's match list has no live clock
    homeGoals: scoreline.home,
    awayGoals: scoreline.away,
    homeCode,
    awayCode,
    resultConfirmed: final,
    advancedCode,
  };
}
