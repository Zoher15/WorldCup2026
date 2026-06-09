import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildStandings,
  BORINGBOT_ID,
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
  // Alice: m1 exact = 10, m2 (1-1 vs 2-2) = outcome 5 + closeness 3 = 8 -> 18
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
  // Alice outcome: m1=5, m2=5 -> 10 ; Bob outcome: m2=5
  assert.deepEqual(s.win, [
    { userId: "u1", displayName: "Alice", points: 10, movement: 0 },
    { userId: "u2", displayName: "Bob", points: 5, movement: 0 },
  ]);
  // Alice closeness: m1=5, m2=3 -> 8 ; Bob closeness: m2=5
  assert.deepEqual(s.scoreline, [
    { userId: "u1", displayName: "Alice", points: 8, movement: 0 },
    { userId: "u2", displayName: "Bob", points: 5, movement: 0 },
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

test("BoringBot baseline scores 0-0 on every match when included", () => {
  const s = buildStandings({
    members,
    matches,
    predictions,
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
    includeBaseline: true,
  });
  const bot = s.overall.find((r) => r.userId === BORINGBOT_ID);
  assert.ok(bot, "BoringBot should appear on the board");
  // 0-0 vs 0-1: outcome 2 + closeness 4 = 6; 0-0 vs 2-2: outcome 5 + closeness 1 = 6
  assert.equal(bot.points, 12);
  // Slots in by score: Alice 18 > BoringBot 12 > Bob 10
  assert.deepEqual(
    s.overall.map((r) => r.displayName),
    ["Alice", "BoringBot 🤖", "Bob"],
  );
  // win = outcome (7), scoreline = closeness (5)
  assert.equal(s.win.find((r) => r.userId === BORINGBOT_ID)?.points, 7);
  assert.equal(s.scoreline.find((r) => r.userId === BORINGBOT_ID)?.points, 5);
});

test("BoringBot respects the start_even window", () => {
  const s = buildStandings({
    members,
    matches,
    predictions,
    lateJoinPolicy: "start_even",
    groupCreatedAt: "2026-06-25T00:00:00Z", // excludes m1
    includeBaseline: true,
  });
  // only m2 (2-2): 0-0 -> outcome 5 + closeness 1 = 6
  assert.equal(s.overall.find((r) => r.userId === BORINGBOT_ID)?.points, 6);
});

test("baseline is opt-in (off by default)", () => {
  const s = buildStandings({
    members,
    matches,
    predictions,
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
  });
  assert.equal(s.overall.find((r) => r.userId === BORINGBOT_ID), undefined);
});

const trialMatch: StandingMatch = {
  id: "trial",
  kickoffAt: "2026-06-11T18:00:00Z",
  stage: "group",
  resultConfirmed: true,
  homeGoals: 2,
  awayGoals: 1,
  advancedCode: null,
  isTrial: true,
};
const trialPrediction: StandingPrediction = {
  userId: "u1",
  matchId: "trial",
  predHome: 2,
  predAway: 1, // exact -> 10
  advancePick: null,
};

test("trial match counts only when countTrialMatches is on", () => {
  const on = buildStandings({
    members,
    matches: [trialMatch],
    predictions: [trialPrediction],
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
    countTrialMatches: true,
  });
  assert.equal(on.overall.find((r) => r.userId === "u1")?.points, 10);

  const off = buildStandings({
    members,
    matches: [trialMatch],
    predictions: [trialPrediction],
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
    countTrialMatches: false,
  });
  assert.equal(off.overall.find((r) => r.userId === "u1")?.points, 0);
});

test("BoringBot also ignores the trial once it stops counting", () => {
  const off = buildStandings({
    members,
    matches: [trialMatch],
    predictions: [],
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
    includeBaseline: true,
    countTrialMatches: false,
  });
  assert.equal(off.overall.find((r) => r.userId === BORINGBOT_ID)?.points, 0);
});
