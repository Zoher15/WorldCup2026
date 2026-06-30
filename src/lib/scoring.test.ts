import { test } from "node:test";
import assert from "node:assert/strict";
import {
  direction,
  scoreMatch,
  maxMatchPoints,
  SCORE_MULTIPLIER,
  MAX_MATCH_POINTS,
  type Scoreline,
} from "./scoring.ts";
import type { Stage } from "./types.ts";

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

test("an exact group score earns the full 10 points (×1)", () => {
  assert.deepEqual(scoreMatch(sl(0, 1), sl(0, 1)), {
    outcome: 5,
    closeness: 5,
    multiplier: 1,
    total: 10,
  });
  assert.deepEqual(scoreMatch(sl(3, 2), sl(3, 2)), {
    outcome: 5,
    closeness: 5,
    multiplier: 1,
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
    multiplier: 1,
    total: 9,
  });
  // predicted a draw -> half-wrong direction
  assert.deepEqual(scoreMatch(sl(0, 0), actual), {
    outcome: 2,
    closeness: 4,
    multiplier: 1,
    total: 6,
  });
  // predicted the wrong winner -> punished hardest
  assert.deepEqual(scoreMatch(sl(1, 0), actual), {
    outcome: 0,
    closeness: 3,
    multiplier: 1,
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
    multiplier: 1,
    total: 0,
  });
});

test("a close but wrong-winner guess still earns a little closeness", () => {
  // actual 1-0 home win, predicted 0-1 away win: opposite direction,
  // but only 2 goals of error total.
  assert.deepEqual(scoreMatch(sl(0, 1), sl(1, 0)), {
    outcome: 0,
    closeness: 3,
    multiplier: 1,
    total: 3,
  });
});

test("right draw with off scoreline", () => {
  // both draws -> full outcome, partial closeness
  assert.deepEqual(scoreMatch(sl(0, 0), sl(1, 1)), {
    outcome: 5,
    closeness: 3,
    multiplier: 1,
    total: 8,
  });
});

test("the round multiplier scales the whole match in the knockouts", () => {
  // A flawless quarter-final (×4): 10 face value -> 40 total.
  assert.deepEqual(scoreMatch(sl(2, 1), sl(2, 1), "HOME", "quarter_final"), {
    outcome: 5,
    closeness: 5,
    multiplier: 4,
    total: 40,
  });
  // A flawless final (×7) is the biggest single prize.
  assert.equal(scoreMatch(sl(2, 1), sl(2, 1), "HOME", "final").total, 70);
  // outcome/closeness are reported at face value regardless of round.
  const ko = scoreMatch(sl(0, 2), sl(0, 1), "AWAY", "round_of_16");
  assert.equal(ko.outcome, 5);
  assert.equal(ko.closeness, 4);
  assert.equal(ko.multiplier, 3);
  assert.equal(ko.total, 27); // (5 + 4) × 3
});

test("a knockout tie decided on penalties grades outcome by who advanced, scaled", () => {
  // 1-1 after extra time, HOME win the shootout and advance, in a semi-final (×5).
  // Backed HOME 2-1: wrong scoreline, but right side of the real win.
  const backedWinner = scoreMatch(sl(2, 1), sl(1, 1), "HOME", "semi_final");
  assert.equal(backedWinner.outcome, 5); // HOME won the tie
  assert.equal(backedWinner.closeness, 4); // |2-1| + |1-1| = 1 off
  assert.equal(backedWinner.total, 45); // (5 + 4) × 5

  // Predicted the literal 1-1 draw: nails closeness, but a draw was not the
  // outcome of the tie, so the outcome is one step off.
  const predictedDraw = scoreMatch(sl(1, 1), sl(1, 1), "HOME", "semi_final");
  assert.equal(predictedDraw.outcome, 2);
  assert.equal(predictedDraw.closeness, 5);
  assert.equal(predictedDraw.total, 35); // (2 + 5) × 5
});

test("predictedWinner overrides the outcome grade but not closeness", () => {
  // A 1-1 prediction whose owner called HOME to advance, in a tie HOME won on
  // penalties (actual 1-1, actualWinner HOME): outcome graded as backing HOME.
  const right = scoreMatch(sl(1, 1), sl(1, 1), "HOME", "quarter_final", "HOME");
  assert.equal(right.outcome, 5); // backed the side that went through
  assert.equal(right.closeness, 5); // closeness is still the literal 1-1
  assert.equal(right.total, 40); // (5 + 5) × 4

  // Same draw, but they backed AWAY (the side that went out): a wrong winner.
  const wrong = scoreMatch(sl(1, 1), sl(1, 1), "HOME", "quarter_final", "AWAY");
  assert.equal(wrong.outcome, 0); // opposite of who advanced
  assert.equal(wrong.closeness, 5); // closeness unchanged by the bad pick
  assert.equal(wrong.total, 20); // (0 + 5) × 4

  // Closeness ignores predictedWinner entirely: a 2-0 prediction with a HOME
  // override still scores closeness off the 2-0 vs 1-1 scoreline.
  const offScore = scoreMatch(sl(2, 0), sl(1, 1), "HOME", "group", "HOME");
  assert.equal(offScore.closeness, 3); // |2-1| + |0-1| = 2 off
});

test("maxMatchPoints climbs the integer ladder", () => {
  assert.equal(maxMatchPoints("group"), 10);
  assert.equal(maxMatchPoints("round_of_32"), 20);
  assert.equal(maxMatchPoints("round_of_16"), 30);
  assert.equal(maxMatchPoints("quarter_final"), 40);
  assert.equal(maxMatchPoints("semi_final"), 50);
  assert.equal(maxMatchPoints("third_place"), 40); // level with the quarter-final
  assert.equal(maxMatchPoints("final"), 70);
  assert.equal(SCORE_MULTIPLIER.third_place, SCORE_MULTIPLIER.quarter_final);
});

test("the knockouts outweigh the group stage (930 vs 720 of 1650)", () => {
  // Official 2026 match counts per stage.
  const COUNTS: Record<Stage, number> = {
    group: 72,
    round_of_32: 16,
    round_of_16: 8,
    quarter_final: 4,
    semi_final: 2,
    third_place: 1,
    final: 1,
  };
  const pool = (stages: Stage[]) =>
    stages.reduce((sum, s) => sum + COUNTS[s] * maxMatchPoints(s), 0);

  const groupPool = pool(["group"]);
  const knockoutPool = pool([
    "round_of_32",
    "round_of_16",
    "quarter_final",
    "semi_final",
    "third_place",
    "final",
  ]);

  assert.equal(groupPool, 720);
  assert.equal(knockoutPool, 930);
  assert.equal(groupPool + knockoutPool, 1650);
  assert.ok(knockoutPool > groupPool); // knockouts carry the most weight
});

test("total is always (outcome + closeness) × multiplier, within bounds", () => {
  const stages: Stage[] = [
    "group",
    "round_of_32",
    "round_of_16",
    "quarter_final",
    "semi_final",
    "third_place",
    "final",
  ];
  for (const stage of stages) {
    for (let ph = 0; ph <= 6; ph++) {
      for (let pa = 0; pa <= 6; pa++) {
        for (let ah = 0; ah <= 6; ah++) {
          for (let aa = 0; aa <= 6; aa++) {
            const s = scoreMatch(sl(ph, pa), sl(ah, aa), undefined, stage);
            assert.equal((s.outcome + s.closeness) * s.multiplier, s.total);
            assert.ok(s.total >= 0 && s.total <= maxMatchPoints(stage));
            assert.ok(s.outcome === 0 || s.outcome === 2 || s.outcome === 5);
            assert.ok(s.closeness >= 0 && s.closeness <= MAX_MATCH_POINTS - 5);
            assert.equal(s.multiplier, SCORE_MULTIPLIER[stage]);
          }
        }
      }
    }
  }
});

test("invalid scorelines are rejected", () => {
  assert.throws(() => scoreMatch(sl(-1, 0), sl(0, 0)), RangeError);
  assert.throws(() => scoreMatch(sl(0, 0), sl(0, 1.5)), RangeError);
  assert.throws(() => scoreMatch(sl(Number.NaN, 0), sl(0, 0)), RangeError);
});
