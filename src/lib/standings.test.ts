import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildStandings,
  competitionRanks,
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
    homeCode: null,
    awayCode: null,
  },
  {
    id: "m2", // later match, 2-2
    kickoffAt: "2026-06-28T19:00:00Z",
    stage: "group",
    resultConfirmed: true,
    homeGoals: 2,
    awayGoals: 2,
    advancedCode: null,
    homeCode: null,
    awayCode: null,
  },
  {
    id: "m3", // not confirmed yet — must never count
    kickoffAt: "2026-06-29T19:00:00Z",
    stage: "group",
    resultConfirmed: false,
    homeGoals: null,
    awayGoals: null,
    advancedCode: null,
    homeCode: null,
    awayCode: null,
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
    { userId: "u1", displayName: "Alice", points: 18, movement: 0, streak: 2 },
    { userId: "u2", displayName: "Bob", points: 10, movement: 0, streak: 1 },
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

test("a live (unconfirmed) score counts provisionally when flagged", () => {
  // m3 is unconfirmed, but in play with a score and the live flag set — it
  // should grade exactly like a confirmed result.
  const liveMatches: StandingMatch[] = [
    { ...matches[2], homeGoals: 3, awayGoals: 0, live: true }, // Alice predicted 3-0
  ];
  const s = buildStandings({
    members: [members[0]],
    matches: liveMatches,
    predictions: predictions.filter((p) => p.matchId === "m3"),
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
    includeBaseline: true,
  });
  // Alice nailed the live 3-0 -> a full exact-score 10.
  assert.equal(s.overall.find((r) => r.userId === "u1")?.points, 10);
  // BoringBot's 0-0 also scores against the live 3-0 (outcome 2 + closeness 2 = 4).
  assert.equal(s.overall.find((r) => r.userId === BORINGBOT_ID)?.points, 4);
});

test("an unflagged unconfirmed score still never counts", () => {
  // Same scoreline, but without the live flag (not in play / not yet trusted):
  // it must stay out of the totals.
  const s = buildStandings({
    members: [members[0]],
    matches: [{ ...matches[2], homeGoals: 3, awayGoals: 0 }],
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
    { userId: "u2", displayName: "Bob", points: 10, movement: 0, streak: 1 },
    { userId: "u1", displayName: "Alice", points: 8, movement: 0, streak: 1 },
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
    { userId: "u1", displayName: "Alice", points: 10, movement: 0, streak: 2 },
    { userId: "u2", displayName: "Bob", points: 5, movement: 0, streak: 1 },
  ]);
  // Alice closeness: m1=5, m2=3 -> 8 ; Bob closeness: m2=5
  assert.deepEqual(s.scoreline, [
    { userId: "u1", displayName: "Alice", points: 8, movement: 0, streak: 2 },
    { userId: "u2", displayName: "Bob", points: 5, movement: 0, streak: 1 },
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
  homeCode: null,
  awayCode: null,
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

test("streaks count consecutive settled wins, newest first", () => {
  // Alice scored on m2 (latest settled) and m1 -> streak 2.
  // Bob scored on m2 but has no pick on m1 -> streak 1.
  const s = buildStandings({
    members,
    matches,
    predictions,
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
  });
  assert.equal(s.overall.find((r) => r.userId === "u1")?.streak, 2);
  assert.equal(s.overall.find((r) => r.userId === "u2")?.streak, 1);
});

test("a zero-point settled match breaks the streak", () => {
  // Bob's pick on the LATEST match is a 0-pointer (wrong winner by two steps,
  // scoreline miles off), so even a perfect earlier match doesn't run.
  const late: StandingMatch = {
    ...matches[0],
    id: "m4",
    kickoffAt: "2026-06-30T19:00:00Z", // 0-1 away win, after m2
  };
  const s = buildStandings({
    members,
    matches: [...matches, late],
    predictions: [
      { userId: "u2", matchId: "m2", predHome: 2, predAway: 2, advancePick: null },
      { userId: "u2", matchId: "m4", predHome: 5, predAway: 0, advancePick: null },
    ],
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
  });
  assert.equal(s.overall.find((r) => r.userId === "u2")?.streak, 0);
});

test("live provisional scores never move a streak", () => {
  const s = buildStandings({
    members: [members[0]],
    matches: [{ ...matches[2], homeGoals: 3, awayGoals: 0, live: true }],
    predictions: predictions.filter((p) => p.matchId === "m3"),
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
  });
  // The live exact 10 counts toward points but not the streak.
  assert.equal(s.overall[0].points, 10);
  assert.equal(s.overall[0].streak, 0);
});

test("the trial match never feeds a streak once retired", () => {
  const s = buildStandings({
    members,
    matches: [trialMatch],
    predictions: [trialPrediction],
    lateJoinPolicy: "carry_over",
    groupCreatedAt: "2026-06-01T00:00:00Z",
    countTrialMatches: false,
  });
  assert.equal(s.overall.find((r) => r.userId === "u1")?.streak, 0);
});

test("competitionRanks shares a rank across ties (1, 1, 3 style)", () => {
  const pts = (...points: number[]) => points.map((p) => ({ points: p }));
  assert.deepEqual(competitionRanks(pts(9, 7, 5)), [1, 2, 3]);
  // Ten tied for 2nd are all "=2", and the next rank skips past them.
  assert.deepEqual(
    competitionRanks(pts(9, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 4)),
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 12],
  );
  assert.deepEqual(competitionRanks([]), []);
});
