import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildStandings,
  type StandingMatch,
  type StandingMember,
  type StandingPrediction,
} from "./standings.ts";

const members: StandingMember[] = [
  { userId: "u1", displayName: "Alice", joinedAt: "2026-06-01T00:00:00Z" },
  { userId: "u2", displayName: "Bob", joinedAt: "2026-06-25T00:00:00Z" },
];

const matches: StandingMatch[] = [
  {
    id: "m1", // early match, 0-1
    kickoffAt: "2026-06-11T19:00:00Z",
    stage: "group",
    resultConfirmed: true,
    homeGoals: 0,
    awayGoals: 1,
    advancedCode: null,
  },
  {
    id: "m2", // later match, 2-2
    kickoffAt: "2026-06-28T19:00:00Z",
    stage: "group",
    resultConfirmed: true,
    homeGoals: 2,
    awayGoals: 2,
    advancedCode: null,
  },
  {
    id: "m3", // not confirmed yet — must never count
    kickoffAt: "2026-06-29T19:00:00Z",
    stage: "group",
    resultConfirmed: false,
    homeGoals: null,
    awayGoals: null,
    advancedCode: null,
  },
];

const predictions: StandingPrediction[] = [
  // Alice nails m1 (10), gets m2 direction right but off score
  { userId: "u1", matchId: "m1", predHome: 0, predAway: 1, advancePick: null },
  { userId: "u1", matchId: "m2", predHome: 1, predAway: 1, advancePick: null },
  // Bob only predicted m2 exactly (10)
  { userId: "u2", matchId: "m2", predHome: 2, predAway: 2, advancePick: null },
  // a stray prediction on the unconfirmed match
  { userId: "u1", matchId: "m3", predHome: 3, predAway: 0, advancePick: null },
];

test("carry_over counts every locked prediction", () => {
  const s = buildStandings({
    members,
    matches,
    predictions,
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
  });
  // Alice: m1 exact = 10, m2 (1-1 vs 2-2) = outcome 6 + closeness 2 = 8 -> 18
  // Bob: m2 exact = 10
  assert.deepEqual(s.overall, [
    { userId: "u1", displayName: "Alice", points: 18, movement: 0 },
    { userId: "u2", displayName: "Bob", points: 10, movement: 0 },
  ]);
});

test("the unconfirmed match never contributes points", () => {
  const s = buildStandings({
    members: [members[0]],
    matches,
    predictions: predictions.filter((p) => p.matchId === "m3"),
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
  });
  assert.equal(s.overall[0].points, 0);
});

test("start_even ignores matches before the group was created", () => {
  const s = buildStandings({
    members,
    matches,
    predictions,
    lateJoinPolicy: "start_even",
    groupCreatedAt: "2026-06-25T00:00:00Z", // after m1, before m2
  });
  // m1 excluded for everyone; only m2 counts.
  // Alice m2 = 8, Bob m2 = 10 -> Bob leads
  assert.deepEqual(s.overall, [
    { userId: "u2", displayName: "Bob", points: 10, movement: 0 },
    { userId: "u1", displayName: "Alice", points: 8, movement: 0 },
  ]);
});

test("win and scoreline boards split the score components", () => {
  const s = buildStandings({
    members,
    matches,
    predictions,
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
  });
  // Alice outcome: m1=6, m2=6 -> 12 ; Bob outcome: m2=6
  assert.deepEqual(s.win, [
    { userId: "u1", displayName: "Alice", points: 12, movement: 0 },
    { userId: "u2", displayName: "Bob", points: 6, movement: 0 },
  ]);
  // Alice closeness: m1=4, m2=2 -> 6 ; Bob closeness: m2=4
  assert.deepEqual(s.scoreline, [
    { userId: "u1", displayName: "Alice", points: 6, movement: 0 },
    { userId: "u2", displayName: "Bob", points: 4, movement: 0 },
  ]);
});

test("members with no scored predictions still appear at zero", () => {
  const s = buildStandings({
    members,
    matches,
    predictions: [],
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
  });
  assert.equal(s.overall.length, 2);
  assert.ok(s.overall.every((r) => r.points === 0));
});
