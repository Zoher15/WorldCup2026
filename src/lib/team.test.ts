import { test } from "node:test";
import assert from "node:assert/strict";
import { teamOutcome } from "./team-outcome.ts";

const res = (home: number, away: number, advancedCode: string | null = null) => ({
  home,
  away,
  advancedCode,
});

test("a decisive scoreline is a win or loss from each side", () => {
  // ARG (home) beat BRA 2-1.
  assert.equal(teamOutcome(res(2, 1), true, "ARG", "group"), "W");
  assert.equal(teamOutcome(res(2, 1), false, "BRA", "group"), "L");
  // The mirror: an away win.
  assert.equal(teamOutcome(res(0, 2), true, "ARG", "group"), "L");
  assert.equal(teamOutcome(res(0, 2), false, "BRA", "group"), "W");
});

test("a level group scoreline is a genuine draw for both", () => {
  assert.equal(teamOutcome(res(1, 1), true, "ARG", "group"), "D");
  assert.equal(teamOutcome(res(1, 1), false, "BRA", "group"), "D");
});

test("a level knockout tie is settled on penalties, never a draw", () => {
  // 1-1 after extra time; ARG (home) advanced on penalties.
  const ko = res(1, 1, "ARG");
  assert.equal(teamOutcome(ko, true, "ARG", "round_of_16"), "W"); // advanced
  assert.equal(teamOutcome(ko, false, "BRA", "round_of_16"), "L"); // went out
});

test("a knockout with no recorded advancer falls back to a draw", () => {
  // Shouldn't happen once results are confirmed, but never guess a winner.
  assert.equal(teamOutcome(res(0, 0, null), true, "ARG", "quarter_final"), "D");
});
