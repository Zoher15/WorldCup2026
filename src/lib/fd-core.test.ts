import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFdFinal,
  fdStatusToOurs,
  deriveFdUpdate,
  matchFdToLocal,
} from "./fd-core.ts";
import { resolveFdTeam } from "./fifa.ts";
import type { FdMatch } from "./footballdata.ts";
import type { LocalMatchRef } from "./sync-core.ts";

const resolve = resolveFdTeam;

function fd(over: Partial<FdMatch> = {}): FdMatch {
  return {
    id: 537327,
    utcDate: "2026-06-11T19:00:00Z",
    status: "TIMED",
    stage: "GROUP_STAGE",
    group: "GROUP_A",
    homeTeam: { id: 769, name: "Mexico", tla: "MEX" },
    awayTeam: { id: 774, name: "South Africa", tla: "RSA" },
    score: { winner: null, duration: "REGULAR", fullTime: { home: null, away: null } },
    ...over,
  };
}

test("status mapping", () => {
  assert.equal(fdStatusToOurs("TIMED"), "scheduled");
  assert.equal(fdStatusToOurs("IN_PLAY"), "live");
  assert.equal(fdStatusToOurs("PAUSED"), "live");
  assert.equal(fdStatusToOurs("FINISHED"), "finished");
  assert.equal(fdStatusToOurs("POSTPONED"), "postponed");
  assert.equal(fdStatusToOurs("CANCELLED"), "cancelled");
  assert.ok(isFdFinal("FINISHED") && isFdFinal("AWARDED"));
  assert.ok(!isFdFinal("IN_PLAY"));
});

test("a scheduled match resolves teams but isn't confirmed", () => {
  const u = deriveFdUpdate(fd(), { isKnockout: false, resolveTeam: resolve });
  assert.equal(u.status, "scheduled");
  assert.equal(u.homeCode, "MEX");
  assert.equal(u.awayCode, "RSA");
  assert.equal(u.resultConfirmed, false);
});

test("a finished group match is confirmed with the final score", () => {
  const u = deriveFdUpdate(
    fd({ status: "FINISHED", score: { winner: "AWAY_TEAM", duration: "REGULAR", fullTime: { home: 0, away: 1 } } }),
    { isKnockout: false, resolveTeam: resolve },
  );
  assert.equal(u.resultConfirmed, true);
  assert.equal(u.homeGoals, 0);
  assert.equal(u.awayGoals, 1);
  assert.equal(u.advancedCode, null); // no advance in group stage
});

test("a knockout advances the score.winner", () => {
  const u = deriveFdUpdate(
    fd({
      stage: "LAST_16",
      status: "FINISHED",
      homeTeam: { id: 1, name: "Argentina", tla: "ARG" },
      awayTeam: { id: 2, name: "Brazil", tla: "BRA" },
      score: { winner: "HOME_TEAM", duration: "PENALTY_SHOOTOUT", fullTime: { home: 1, away: 1 } },
    }),
    { isKnockout: true, resolveTeam: resolve },
  );
  assert.equal(u.resultConfirmed, true);
  assert.equal(u.homeGoals, 1); // scoreline excludes the shootout
  assert.equal(u.advancedCode, "ARG");
});

test("matching by time, disambiguating by teams", () => {
  const locals: LocalMatchRef[] = [
    { id: "a", kickoffAt: "2026-06-11T19:00:00Z", homeCode: "MEX", awayCode: "RSA" },
    { id: "b", kickoffAt: "2026-06-11T19:00:00Z", homeCode: "USA", awayCode: "ENG" },
  ];
  assert.equal(matchFdToLocal(fd(), locals, resolve), "a");
  assert.equal(
    matchFdToLocal(fd({ utcDate: "2026-07-01T19:00:00Z" }), locals, resolve),
    null,
  );
});
