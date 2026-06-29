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
import type { LocalMatchRef } from "./types.ts";

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
  assert.equal(u.awayGoals, 1);
  assert.equal(u.advancedCode, "ARG");
});

test("a shootout folded into fullTime is stripped back to the level scoreline", () => {
  // football-data's fullTime is the FINAL score and folds the shootout in: a
  // 1-1 after extra time won 6-5 on penalties is reported as 7-6. We must grade
  // closeness on the 1-1, not the post-shootout 7-6 — so peel the pens back off.
  const u = deriveFdUpdate(
    fd({
      stage: "QUARTER_FINALS",
      status: "FINISHED",
      homeTeam: { id: 1, name: "Argentina", tla: "ARG" },
      awayTeam: { id: 2, name: "Brazil", tla: "BRA" },
      score: {
        winner: "HOME_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 7, away: 6 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 6, away: 5 },
      },
    }),
    { isKnockout: true, resolveTeam: resolve },
  );
  assert.equal(u.homeGoals, 1); // 7 − 6 pens
  assert.equal(u.awayGoals, 1); // 6 − 5 pens
  assert.equal(u.advancedCode, "ARG");
});

test("a shootout keyed homeTeam/awayTeam is still stripped (key-name tolerance)", () => {
  // The regression that leaked the post-shootout score: when the penalties tally
  // is keyed homeTeam/awayTeam (not home/away), reading `.home` gave undefined,
  // the strip was skipped, and fullTime's 7-6 went straight into closeness.
  const u = deriveFdUpdate(
    fd({
      stage: "SEMI_FINALS",
      status: "FINISHED",
      homeTeam: { id: 1, name: "Argentina", tla: "ARG" },
      awayTeam: { id: 2, name: "Brazil", tla: "BRA" },
      score: {
        winner: "AWAY_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { homeTeam: 4, awayTeam: 5 },
        penalties: { homeTeam: 3, awayTeam: 4 },
      },
    }),
    { isKnockout: true, resolveTeam: resolve },
  );
  assert.equal(u.homeGoals, 1); // 4 − 3 pens
  assert.equal(u.awayGoals, 1); // 5 − 4 pens
  assert.equal(u.advancedCode, "BRA");
});

test("a shootout with no penalties tally falls back to regulation + extra time", () => {
  // If a feed omits the penalties tally but gives the clean components, rebuild
  // the on-pitch score from regularTime + extraTime rather than trusting the
  // shootout-inflated fullTime.
  const u = deriveFdUpdate(
    fd({
      stage: "FINAL",
      status: "FINISHED",
      homeTeam: { id: 1, name: "Argentina", tla: "ARG" },
      awayTeam: { id: 2, name: "Brazil", tla: "BRA" },
      score: {
        winner: "HOME_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 6, away: 4 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 1, away: 1 },
      },
    }),
    { isKnockout: true, resolveTeam: resolve },
  );
  assert.equal(u.homeGoals, 2); // 1 reg + 1 ET
  assert.equal(u.awayGoals, 2); // 1 reg + 1 ET
  assert.equal(u.advancedCode, "ARG");
});

test("a level fullTime that already excludes the shootout is left alone", () => {
  // The other convention: fullTime is the 1-1 draw and penalties holds 6-5.
  // Subtracting would go negative, so we must NOT — the 1-1 is already right.
  const u = deriveFdUpdate(
    fd({
      stage: "ROUND_OF_16",
      status: "FINISHED",
      homeTeam: { id: 1, name: "Argentina", tla: "ARG" },
      awayTeam: { id: 2, name: "Brazil", tla: "BRA" },
      score: {
        winner: "HOME_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 1, away: 1 },
        regularTime: { home: 1, away: 1 },
        penalties: { home: 6, away: 5 },
      },
    }),
    { isKnockout: true, resolveTeam: resolve },
  );
  assert.equal(u.homeGoals, 1);
  assert.equal(u.awayGoals, 1);
  assert.equal(u.advancedCode, "ARG");
});

test("an extra-time win keeps its real (unlevel) scoreline", () => {
  // 2-1 after extra time, no shootout — must NOT be touched by the guard.
  const u = deriveFdUpdate(
    fd({
      stage: "LAST_16",
      status: "FINISHED",
      homeTeam: { id: 1, name: "Argentina", tla: "ARG" },
      awayTeam: { id: 2, name: "Brazil", tla: "BRA" },
      score: { winner: "HOME_TEAM", duration: "EXTRA_TIME", fullTime: { home: 2, away: 1 } },
    }),
    { isKnockout: true, resolveTeam: resolve },
  );
  assert.equal(u.homeGoals, 2);
  assert.equal(u.awayGoals, 1);
  assert.equal(u.advancedCode, "ARG");
});

test("a scheduled knockout resolves its teams for pre-fill, without confirming", () => {
  // Once the bracket is known the fixture is still TIMED (not yet kicked off);
  // we resolve its teams so the matchup can be filled in before predictions open.
  const u = deriveFdUpdate(
    fd({
      stage: "LAST_16",
      status: "TIMED",
      homeTeam: { id: 1, name: "Argentina", tla: "ARG" },
      awayTeam: { id: 2, name: "Brazil", tla: "BRA" },
    }),
    { isKnockout: true, resolveTeam: resolve },
  );
  assert.equal(u.status, "scheduled");
  assert.equal(u.resultConfirmed, false);
  assert.equal(u.homeCode, "ARG");
  assert.equal(u.awayCode, "BRA");
  assert.equal(u.advancedCode, null); // not decided yet
});

test("an unresolved knockout slot resolves to null (no premature fill)", () => {
  // Before the prior round finishes a slot is still a placeholder; it must not
  // be written as a team.
  const u = deriveFdUpdate(
    fd({
      stage: "LAST_16",
      status: "TIMED",
      homeTeam: { id: 0, name: "Winner Group A", tla: null },
      awayTeam: { id: 2, name: "Brazil", tla: "BRA" },
    }),
    { isKnockout: true, resolveTeam: resolve },
  );
  assert.equal(u.homeCode, null); // placeholder -> not written
  assert.equal(u.awayCode, "BRA");
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
