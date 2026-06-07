import { test } from "node:test";
import assert from "node:assert/strict";
import {
  direction,
  scoreMatch,
  advancePoints,
  ADVANCE_BONUS,
  MAX_MATCH_POINTS,
  type Scoreline,
} from "./scoring.ts";

const sl = (homeGoals: number, awayGoals: number): Scoreline => ({
  homeGoals,
  awayGoals,
});

test("direction classifies winners and draws", () => {
  assert.equal(direction(sl(2, 1)), "HOME");
  assert.equal(direction(sl(0, 1)), "AWAY");
  assert.equal(direction(sl(1, 1)), "DRAW");
  assert.equal(direction(sl(0, 0)), "DRAW");
});

test("an exact score earns the full 10 points", () => {
  assert.deepEqual(scoreMatch(sl(0, 1), sl(0, 1)), {
    outcome: 5,
    closeness: 5,
    total: 10,
  });
  assert.deepEqual(scoreMatch(sl(3, 2), sl(3, 2)), {
    outcome: 5,
    closeness: 5,
    total: 10,
  });
});

test("the away-win 0-1 example ranks predictions correctly", () => {
  const actual = sl(0, 1); // away win
  // exact
  assert.equal(scoreMatch(sl(0, 1), actual).total, 10);
  // right winner, one goal off -> "right direction" is rewarded
  assert.deepEqual(scoreMatch(sl(0, 2), actual), {
    outcome: 5,
    closeness: 4,
    total: 9,
  });
  // predicted a draw -> half-wrong direction
  assert.deepEqual(scoreMatch(sl(0, 0), actual), {
    outcome: 2,
    closeness: 4,
    total: 6,
  });
  // predicted the wrong winner -> punished hardest
  assert.deepEqual(scoreMatch(sl(1, 0), actual), {
    outcome: 0,
    closeness: 3,
    total: 3,
  });
});

test("predicting the wrong winner costs more than predicting a draw", () => {
  const actual = sl(0, 1); // away win
  const drawGuess = scoreMatch(sl(0, 0), actual).outcome; // 2
  const wrongWinnerGuess = scoreMatch(sl(1, 0), actual).outcome; // 0
  assert.ok(
    wrongWinnerGuess < drawGuess,
    "wrong winner must lose more outcome points than a draw guess",
  );
  assert.equal(drawGuess, 2);
  assert.equal(wrongWinnerGuess, 0);
});

test("over-prediction of goals decays closeness smoothly (5-0 != 10-0)", () => {
  const actual = sl(5, 0);
  assert.equal(scoreMatch(sl(5, 0), actual).total, 10);
  assert.equal(scoreMatch(sl(6, 0), actual).total, 9);
  assert.equal(scoreMatch(sl(7, 0), actual).total, 8);
  assert.equal(scoreMatch(sl(8, 0), actual).total, 7);
  assert.equal(scoreMatch(sl(10, 0), actual).total, 5); // capped at 0 closeness
});

test("closeness never goes negative", () => {
  // wildly wrong but right-ish direction: away win predicted huge
  const actual = sl(0, 0);
  const s = scoreMatch(sl(0, 5), actual);
  assert.equal(s.closeness, 0);
  assert.equal(s.outcome, 2); // predicted away win vs draw = one step
  assert.equal(s.total, 2);
});

test("opposite winner with far scoreline scores zero", () => {
  assert.deepEqual(scoreMatch(sl(0, 3), sl(3, 0)), {
    outcome: 0,
    closeness: 0,
    total: 0,
  });
});

test("a close but wrong-winner guess still earns a little closeness", () => {
  // actual 1-0 home win, predicted 0-1 away win: opposite direction,
  // but only 2 goals of error total.
  assert.deepEqual(scoreMatch(sl(0, 1), sl(1, 0)), {
    outcome: 0,
    closeness: 3,
    total: 3,
  });
});

test("right draw with off scoreline", () => {
  // both draws -> full outcome, partial closeness
  assert.deepEqual(scoreMatch(sl(0, 0), sl(1, 1)), {
    outcome: 5,
    closeness: 3,
    total: 8,
  });
});

test("outcome + closeness always equals total, and total is within 0..10", () => {
  for (let ph = 0; ph <= 6; ph++) {
    for (let pa = 0; pa <= 6; pa++) {
      for (let ah = 0; ah <= 6; ah++) {
        for (let aa = 0; aa <= 6; aa++) {
          const s = scoreMatch(sl(ph, pa), sl(ah, aa));
          assert.equal(s.outcome + s.closeness, s.total);
          assert.ok(s.total >= 0 && s.total <= MAX_MATCH_POINTS);
          assert.ok(s.outcome === 0 || s.outcome === 2 || s.outcome === 5);
          assert.ok(s.closeness >= 0 && s.closeness <= 5);
        }
      }
    }
  }
});

test("advance bonus rewards the correct knockout pick", () => {
  assert.equal(advancePoints("ARG", "ARG"), ADVANCE_BONUS);
  assert.equal(advancePoints("ARG", "FRA"), 0);
  assert.equal(advancePoints(null, "FRA"), 0);
  assert.equal(advancePoints("ARG", null), 0);
  assert.equal(advancePoints(undefined, undefined), 0);
});

test("invalid scorelines are rejected", () => {
  assert.throws(() => scoreMatch(sl(-1, 0), sl(0, 0)), RangeError);
  assert.throws(() => scoreMatch(sl(0, 0), sl(0, 1.5)), RangeError);
  assert.throws(() => scoreMatch(sl(Number.NaN, 0), sl(0, 0)), RangeError);
});
