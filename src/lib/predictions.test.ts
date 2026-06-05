import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLocked,
  isValidGoals,
  isWindowOpen,
  windowOpensAt,
  predictionState,
  PREDICTION_WINDOW_HOURS,
} from "./prediction-rules.ts";

test("isLocked flips at kickoff", () => {
  const kickoff = "2026-06-11T19:00:00Z";
  assert.equal(isLocked(kickoff, new Date("2026-06-11T18:59:59Z")), false);
  assert.equal(isLocked(kickoff, new Date("2026-06-11T19:00:00Z")), true);
  assert.equal(isLocked(kickoff, new Date("2026-06-11T20:00:00Z")), true);
});

test("the window opens exactly PREDICTION_WINDOW_HOURS before kickoff", () => {
  const kickoff = "2026-06-11T19:00:00Z";
  const opens = windowOpensAt(kickoff);
  assert.equal(Date.parse(kickoff) - opens, PREDICTION_WINDOW_HOURS * 3600_000);
});

test("isWindowOpen is true only within the 24h pre-kickoff window", () => {
  const kickoff = "2026-06-11T19:00:00Z";
  // 25h before -> not yet open
  assert.equal(isWindowOpen(kickoff, new Date("2026-06-10T18:00:00Z")), false);
  // exactly 24h before -> opens
  assert.equal(isWindowOpen(kickoff, new Date("2026-06-10T19:00:00Z")), true);
  // 1h before -> open
  assert.equal(isWindowOpen(kickoff, new Date("2026-06-11T18:00:00Z")), true);
  // at kickoff -> closed
  assert.equal(isWindowOpen(kickoff, new Date("2026-06-11T19:00:00Z")), false);
});

test("predictionState reports upcoming / open / locked", () => {
  const kickoff = "2026-06-11T19:00:00Z";
  assert.equal(predictionState(kickoff, new Date("2026-06-10T12:00:00Z")), "upcoming");
  assert.equal(predictionState(kickoff, new Date("2026-06-11T12:00:00Z")), "open");
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
