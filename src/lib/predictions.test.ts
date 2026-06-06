import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLocked,
  isValidGoals,
  isWindowOpen,
  windowOpensAt,
  predictionState,
} from "./prediction-rules.ts";

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

test("isValidGoals accepts sane scores, rejects junk", () => {
  assert.equal(isValidGoals(0, 0), true);
  assert.equal(isValidGoals(3, 2), true);
  assert.equal(isValidGoals(-1, 0), false);
  assert.equal(isValidGoals(0, 1.5), false);
  assert.equal(isValidGoals(0, 99), false);
  assert.equal(isValidGoals(Number.NaN, 0), false);
});
