import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLocked,
  isValidAdvanceCode,
  isValidGoals,
  isWindowOpen,
  windowOpensAt,
  predictionState,
  roundOpensByStage,
} from "./prediction-rules.ts";
import type { Stage } from "./types.ts";

test("isLocked flips at kickoff", () => {
  const kickoff = "2026-06-11T19:00:00Z";
  assert.equal(isLocked(kickoff, new Date("2026-06-11T18:59:59Z")), false);
  assert.equal(isLocked(kickoff, new Date("2026-06-11T19:00:00Z")), true);
  assert.equal(isLocked(kickoff, new Date("2026-06-11T20:00:00Z")), true);
});

test("window opens at 00:00 UTC+14 the day before (anywhere on earth)", () => {
  // Kickoff 19:00Z shifts to June 12 in UTC+14; the day before is June 11, whose
  // midnight in UTC+14 is 2026-06-10T10:00Z — the moment the window opens.
  const kickoff = "2026-06-11T19:00:00Z";
  assert.equal(windowOpensAt(kickoff), Date.parse("2026-06-10T10:00:00Z"));
});

test("every game on the same match-day shares one open time", () => {
  // A late kickoff that rolls past UTC midnight is the same Americas match-day
  // as an afternoon kickoff, so both must open together.
  const afternoon = "2026-06-11T19:00:00Z";
  const lateNight = "2026-06-12T02:00:00Z"; // ~22:00 ET, still June 11 locally
  assert.equal(windowOpensAt(afternoon), windowOpensAt(lateNight));
});

test("isWindowOpen runs from that open time until kickoff", () => {
  const kickoff = "2026-06-11T19:00:00Z"; // opens 2026-06-10T10:00Z
  // just before the open
  assert.equal(isWindowOpen(kickoff, new Date("2026-06-10T09:59:00Z")), false);
  // at the open
  assert.equal(isWindowOpen(kickoff, new Date("2026-06-10T10:00:00Z")), true);
  // 1h before kickoff -> open
  assert.equal(isWindowOpen(kickoff, new Date("2026-06-11T18:00:00Z")), true);
  // at kickoff -> closed
  assert.equal(isWindowOpen(kickoff, new Date("2026-06-11T19:00:00Z")), false);
});

test("predictionState reports upcoming / open / locked", () => {
  const kickoff = "2026-06-11T19:00:00Z"; // opens 2026-06-10T10:00Z
  assert.equal(predictionState(kickoff, new Date("2026-06-10T08:00:00Z")), "upcoming");
  assert.equal(predictionState(kickoff, new Date("2026-06-10T12:00:00Z")), "open");
  assert.equal(predictionState(kickoff, new Date("2026-06-11T19:30:00Z")), "locked");
});

test("roundOpensByStage anchors each knockout round to its earliest game", () => {
  const matches: { stage: Stage; kickoffAt: string }[] = [
    { stage: "group", kickoffAt: "2026-06-20T19:00:00Z" },
    { stage: "round_of_32", kickoffAt: "2026-06-29T16:00:00Z" }, // earliest R32
    { stage: "round_of_32", kickoffAt: "2026-07-02T20:00:00Z" }, // later R32
    { stage: "round_of_16", kickoffAt: "2026-07-05T16:00:00Z" },
  ];
  const opens = roundOpensByStage(matches);
  // The whole R32 round opens when its FIRST game would have, not each game's day.
  assert.equal(opens.get("round_of_32"), windowOpensAt("2026-06-29T16:00:00Z"));
  assert.equal(opens.get("round_of_16"), windowOpensAt("2026-07-05T16:00:00Z"));
  // The group stage keeps the daily cadence — no round anchor.
  assert.equal(opens.has("group"), false);
});

test("a later knockout game opens with its round, not the day before its own kickoff", () => {
  // Two R32 games: first June 29, a later one July 2. Under the daily rule the
  // July 2 game would still be "upcoming" on June 28; the round anchor opens it
  // together with the round.
  const first = "2026-06-29T16:00:00Z";
  const later = "2026-07-02T20:00:00Z";
  const roundOpen = roundOpensByStage([
    { stage: "round_of_32", kickoffAt: first },
    { stage: "round_of_32", kickoffAt: later },
  ]).get("round_of_32");
  const justAfterRoundOpen = new Date(roundOpen! + 60_000);

  // Without the anchor: the later game is still upcoming (its own day is far off).
  assert.equal(predictionState(later, justAfterRoundOpen), "upcoming");
  // With the round anchor: it's open along with the rest of the round.
  assert.equal(predictionState(later, justAfterRoundOpen, false, roundOpen), "open");
  assert.equal(isWindowOpen(later, justAfterRoundOpen, false, roundOpen), true);
  // Locking is unchanged — still at the game's own kickoff.
  assert.equal(predictionState(later, new Date(later), false, roundOpen), "locked");
});

test("isValidGoals accepts sane scores, rejects junk", () => {
  assert.equal(isValidGoals(0, 0), true);
  assert.equal(isValidGoals(3, 2), true);
  assert.equal(isValidGoals(-1, 0), false);
  assert.equal(isValidGoals(0, 1.5), false);
  assert.equal(isValidGoals(0, 99), false);
  assert.equal(isValidGoals(Number.NaN, 0), false);
});

test("isValidAdvanceCode: null is always fine, codes must be a match team", () => {
  const ko = { stage: "round_of_16", homeCode: "ARG", awayCode: "FRA" };
  assert.equal(isValidAdvanceCode(null, ko), true);
  assert.equal(isValidAdvanceCode(undefined, ko), true);
  assert.equal(isValidAdvanceCode("ARG", ko), true);
  assert.equal(isValidAdvanceCode("FRA", ko), true);
  assert.equal(isValidAdvanceCode("BRA", ko), false);
  assert.equal(isValidAdvanceCode("INVALID", ko), false);
});

test("isValidAdvanceCode: group games take no advance pick", () => {
  const group = { stage: "group", homeCode: "ARG", awayCode: "FRA" };
  assert.equal(isValidAdvanceCode(null, group), true);
  assert.equal(isValidAdvanceCode("ARG", group), false);
});

test("isValidAdvanceCode: knockout placeholders (TBD teams) accept no code", () => {
  const tbd = { stage: "final", homeCode: null, awayCode: null };
  assert.equal(isValidAdvanceCode(null, tbd), true);
  assert.equal(isValidAdvanceCode("ARG", tbd), false);
});
