import { test } from "node:test";
import assert from "node:assert/strict";
import { isLocked, isValidGoals } from "./prediction-rules.ts";

test("isLocked flips at kickoff", () => {
  const kickoff = "2026-06-11T19:00:00Z";
  assert.equal(isLocked(kickoff, new Date("2026-06-11T18:59:59Z")), false);
  assert.equal(isLocked(kickoff, new Date("2026-06-11T19:00:00Z")), true);
  assert.equal(isLocked(kickoff, new Date("2026-06-11T20:00:00Z")), true);
});

test("isValidGoals accepts sane scores, rejects junk", () => {
  assert.equal(isValidGoals(0, 0), true);
  assert.equal(isValidGoals(3, 2), true);
  assert.equal(isValidGoals(-1, 0), false);
  assert.equal(isValidGoals(0, 1.5), false);
  assert.equal(isValidGoals(0, 99), false);
  assert.equal(isValidGoals(Number.NaN, 0), false);
});
