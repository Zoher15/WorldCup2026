/**
 * Pure logic for syncing API-Football fixtures into our matches — no network
 * or database, so it's fully unit-testable. The impure orchestration lives in
 * sync.ts.
 */

import { isFinalStatus, statusToOurs, type ApiFixture } from "./football-api.ts";
import type { MatchStatus } from "./types.ts";

export interface LocalMatchRef {
  id: string;
  kickoffAt: string;
  homeCode: string | null;
  awayCode: string | null;
}

export interface MatchUpdate {
  status: MatchStatus;
  minute: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  /** Resolved team codes (used to fill in knockout teams once known). */
  homeCode: string | null;
  awayCode: string | null;
  /** True only on FT/AET/PEN — the gate that lets points be awarded. */
  resultConfirmed: boolean;
  /** For knockouts: code of the team that advanced (winner after ET/pens). */
  advancedCode: string | null;
}

const THREE_HOURS = 3 * 60 * 60 * 1000;

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/**
 * Find which local match an API fixture corresponds to. Matches on kickoff time
 * within a tolerance; when several candidates share a slot (e.g. simultaneous
 * final-round group games), disambiguates by the team-code pair. Returns null
 * when it can't be sure (caller leaves it for manual mapping).
 */
export function matchApiFixtureToLocal(
  fixture: ApiFixture,
  locals: LocalMatchRef[],
  resolveCode: (name: string) => string | null,
  toleranceMs: number = THREE_HOURS,
): string | null {
  const apiMs = Date.parse(fixture.fixture.date);
  if (Number.isNaN(apiMs)) return null;

  const near = locals.filter(
    (l) => Math.abs(Date.parse(l.kickoffAt) - apiMs) <= toleranceMs,
  );
  if (near.length === 1) return near[0].id;
  if (near.length === 0) return null;

  const hc = resolveCode(fixture.teams.home.name);
  const ac = resolveCode(fixture.teams.away.name);
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
 * Derive the fields to write for a match from its API fixture. Pure given a
 * team-name resolver. `isKnockout` controls whether an advancing team is
 * computed (winner after ET/penalties).
 */
export function deriveMatchUpdate(
  fixture: ApiFixture,
  opts: { isKnockout: boolean; resolveCode: (name: string) => string | null },
): MatchUpdate {
  const short = fixture.fixture.status.short;
  const final = isFinalStatus(short);
  const gh = fixture.goals.home;
  const ga = fixture.goals.away;

  let advancedCode: string | null = null;
  if (final && opts.isKnockout) {
    const ph = fixture.score?.penalty?.home;
    const pa = fixture.score?.penalty?.away;
    let winnerName: string | null = null;
    if (short === "PEN" && ph != null && pa != null) {
      winnerName = ph > pa ? fixture.teams.home.name : fixture.teams.away.name;
    } else if (gh != null && ga != null && gh !== ga) {
      winnerName = gh > ga ? fixture.teams.home.name : fixture.teams.away.name;
    }
    advancedCode = winnerName ? opts.resolveCode(winnerName) : null;
  }

  return {
    status: statusToOurs(short),
    minute: fixture.fixture.status.elapsed ?? null,
    homeGoals: gh,
    awayGoals: ga,
    homeCode: opts.resolveCode(fixture.teams.home.name),
    awayCode: opts.resolveCode(fixture.teams.away.name),
    resultConfirmed: final,
    advancedCode,
  };
}
