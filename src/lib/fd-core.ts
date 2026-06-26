/**
 * Pure logic for syncing football-data.org matches into our matches — no
 * network or DB, so it's unit-testable. Mirrors sync-core but for the
 * football-data schema.
 */

import type { FdMatch } from "./footballdata.ts";
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

/**
 * The on-pitch scoreline to grade against: the score at the end of 90 + extra
 * time, EXCLUDING any penalty shootout. That keeps closeness honest (a tie that
 * went to penalties is graded as the level draw it was), while the shootout
 * result is carried separately via `winner` -> `advancedCode`.
 *
 * football-data v4's `fullTime` is already the end-of-extra-time score, so we
 * use it directly. Belt-and-braces: if a PENALTY_SHOOTOUT record is somehow NOT
 * level yet subtracting the reported `penalties` tally makes it level, we strip
 * the shootout back out — so a provider quirk that folded the shootout into
 * fullTime could never leak into the scoreline.
 */
function endOfPlayScoreline(
  score: FdMatch["score"],
): { home: number | null; away: number | null } {
  const { home, away } = score.fullTime;
  const pens = score.penalties;
  if (
    score.duration === "PENALTY_SHOOTOUT" &&
    home != null &&
    away != null &&
    home !== away &&
    pens?.home != null &&
    pens?.away != null
  ) {
    const h = home - pens.home;
    const a = away - pens.away;
    if (h >= 0 && a >= 0 && h === a) return { home: h, away: a };
  }
  return { home, away };
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
