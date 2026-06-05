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
    outcomePoints: 6,
    closenessPoints: 4,
    advancePoints: 0,
    totalPoints: 10,
  });
});

test("knockout adds the advance bonus, group stage does not", () => {
  const ko = match({
    stage: "round_of_16",
    homeGoals: 1,
    awayGoals: 1,
    advancedCode: "ARG",
  });
  const p = pred({ predHome: 1, predAway: 1, advancePick: "ARG" });
  const s = scorePrediction(p, ko)!;
  assert.equal(s.advancePoints, 3);
  assert.equal(s.totalPoints, 13); // 10 scoreline + 3 advance

  // same prediction in a group match earns no advance bonus
  const g = scorePrediction(pred({ predHome: 1, predAway: 1, advancePick: "ARG" }), match({ homeGoals: 1, awayGoals: 1 }))!;
  assert.equal(g.advancePoints, 0);
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
