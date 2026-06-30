import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isMatchScorable,
  scorePrediction,
  recomputeAll,
} from "./recompute.ts";
import type { Match, Prediction } from "./types.ts";

const match = (over: Partial<Match> = {}): Match => ({
  id: "m1",
  externalRef: null,
  matchNumber: 1,
  stage: "group",
  groupLabel: "A",
  homeTeam: null,
  awayTeam: null,
  homeCode: "ARG",
  awayCode: "BRA",
  kickoffAt: "2026-06-20T18:00:00Z",
  venue: null,
  status: "finished",
  minute: null,
  homeGoals: 0,
  awayGoals: 1,
  advancedCode: null,
  resultConfirmed: true,
  lastSyncedAt: null,
  ...over,
});

const pred = (over: Partial<Prediction> = {}): Prediction => ({
  id: "p1",
  userId: "u1",
  matchId: "m1",
  predHome: 0,
  predAway: 1,
  advancePick: null,
  createdAt: "",
  updatedAt: "",
  ...over,
});

test("a match is only scorable once confirmed with goals", () => {
  assert.equal(isMatchScorable(match()), true);
  assert.equal(isMatchScorable(match({ resultConfirmed: false })), false);
  assert.equal(isMatchScorable(match({ homeGoals: null })), false);
});

test("scorePrediction returns null until the match is scorable", () => {
  assert.equal(scorePrediction(pred(), match({ resultConfirmed: false })), null);
});

test("scorePrediction scores an exact group prediction", () => {
  const s = scorePrediction(pred(), match()); // 0-1 vs 0-1
  assert.deepEqual(s, {
    predictionId: "p1",
    outcomePoints: 5,
    closenessPoints: 5,
    totalPoints: 10,
  });
});

test("a knockout multiplies the score; the group stage does not", () => {
  // ARG (home) wins 2-1 in regulation; a perfect 2-1 prediction in the R16 (×2.5).
  const ko = match({
    stage: "round_of_16",
    homeGoals: 2,
    awayGoals: 1,
    advancedCode: "ARG",
  });
  const p = pred({ predHome: 2, predAway: 1, advancePick: "ARG" });
  const s = scorePrediction(p, ko)!;
  assert.equal(s.outcomePoints, 5); // reported at face value
  assert.equal(s.closenessPoints, 5); // reported at face value
  assert.equal(s.totalPoints, 30); // (5 + 5) × 3

  // the same perfect prediction in a group match is worth face value (×1)
  const g = scorePrediction(
    pred({ predHome: 2, predAway: 1 }),
    match({ homeGoals: 2, awayGoals: 1 }),
  )!;
  assert.equal(g.totalPoints, 10);
});

test("a knockout decided on penalties is graded as a win, not the drawn scoreline", () => {
  // Tie level 1-1 after extra time; ARG (home) win the shootout and advance.
  const ko = match({
    stage: "quarter_final",
    homeGoals: 1,
    awayGoals: 1,
    advancedCode: "ARG", // homeCode in the factory
  });

  // Backed ARG 2-1: wrong scoreline, but right side of a real win now.
  const backedWinner = scorePrediction(
    pred({ predHome: 2, predAway: 1, advancePick: "ARG" }),
    ko,
  )!;
  assert.equal(backedWinner.outcomePoints, 5); // ARG won the tie
  assert.equal(backedWinner.closenessPoints, 4); // |2-1| + |1-1| = 1 off
  assert.equal(backedWinner.totalPoints, 36); // (5 + 4) × 4  (quarter-final)

  // Predicted the literal 1-1 draw with NO advance pick: nails closeness, but a
  // draw was not the outcome of the tie, so the outcome is one step off.
  const bareDraw = scorePrediction(
    pred({ predHome: 1, predAway: 1, advancePick: null }),
    ko,
  )!;
  assert.equal(bareDraw.outcomePoints, 2);
  assert.equal(bareDraw.closenessPoints, 5);
  assert.equal(bareDraw.totalPoints, 28); // (2 + 5) × 4

  // The SAME 1-1 in a group game is a genuine draw — full outcome credit.
  const groupDraw = scorePrediction(
    pred({ predHome: 1, predAway: 1 }),
    match({ stage: "group", homeGoals: 1, awayGoals: 1 }),
  )!;
  assert.equal(groupDraw.outcomePoints, 5);
});

test("a draw prediction's advance pick is graded like backing that team to win", () => {
  // 1-1 after extra time; ARG (home) win the shootout and advance.
  const ko = match({
    stage: "quarter_final",
    homeGoals: 1,
    awayGoals: 1,
    advancedCode: "ARG", // homeCode in the factory
  });

  // Predicted 1-1 AND called ARG to go through — exactly who advanced. The
  // advance pick is their winner call, so it earns full outcome, like a clean win.
  const calledIt = scorePrediction(
    pred({ predHome: 1, predAway: 1, advancePick: "ARG" }),
    ko,
  )!;
  assert.equal(calledIt.outcomePoints, 5); // right team through
  assert.equal(calledIt.closenessPoints, 5); // 1-1 nails the scoreline
  assert.equal(calledIt.totalPoints, 40); // (5 + 5) × 4

  // Predicted 1-1 but backed BRA (the side that went OUT): a real, wrong winner
  // call now — no outcome, only the closeness from the spot-on scoreline.
  const backedLoser = scorePrediction(
    pred({ predHome: 1, predAway: 1, advancePick: "BRA" }),
    ko,
  )!;
  assert.equal(backedLoser.outcomePoints, 0); // backed the wrong side
  assert.equal(backedLoser.closenessPoints, 5);
  assert.equal(backedLoser.totalPoints, 20); // (0 + 5) × 4

  // An advance pick on a NON-draw prediction is irrelevant: the scoreline already
  // names the winner, so the pick can't override a decisive call.
  const decisive = scorePrediction(
    pred({ predHome: 2, predAway: 1, advancePick: "BRA" }),
    match({ stage: "quarter_final", homeGoals: 2, awayGoals: 1, advancedCode: "ARG" }),
  )!;
  assert.equal(decisive.outcomePoints, 5); // predicted ARG to win, ARG won

  // A group draw ignores any stray advance pick — a draw is a genuine result.
  const groupDraw = scorePrediction(
    pred({ predHome: 1, predAway: 1, advancePick: "ARG" }),
    match({ stage: "group", homeGoals: 1, awayGoals: 1 }),
  )!;
  assert.equal(groupDraw.outcomePoints, 5);
});

test("recomputeAll is deterministic and idempotent", () => {
  const matches = new Map([
    ["m1", match()],
    ["m2", match({ id: "m2", homeGoals: 2, awayGoals: 2 })],
  ]);
  const preds = [
    pred({ id: "pa", matchId: "m1", predHome: 0, predAway: 1 }),
    pred({ id: "pb", matchId: "m2", predHome: 1, predAway: 1 }),
    pred({ id: "pc", matchId: "missing" }), // skipped: no such match
  ];
  const first = recomputeAll(preds, matches);
  const second = recomputeAll(preds, matches);
  assert.deepEqual(first, second); // recomputing from raw data is stable
  assert.equal(first.length, 2); // the orphan prediction is skipped
});
