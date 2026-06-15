import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveMatchScore, type MatchScoreSource } from "./match-status.ts";

function row(over: Partial<MatchScoreSource> = {}): MatchScoreSource {
  return {
    status: "scheduled",
    result_confirmed: false,
    home_goals: null,
    away_goals: null,
    advanced_code: null,
    minute: null,
    ...over,
  };
}

test("scheduled match: not over, no result, no live, not liveNoScore", () => {
  const d = deriveMatchScore(row());
  assert.equal(d.isOver, false);
  assert.equal(d.result, null);
  assert.equal(d.live, null);
  assert.equal(d.liveNoScore, false);
});

test("live with a score: live object, not liveNoScore", () => {
  const d = deriveMatchScore(
    row({ status: "live", home_goals: 1, away_goals: 0, minute: 67 }),
  );
  assert.deepEqual(d.live, { home: 1, away: 0, minute: 67 });
  assert.equal(d.liveNoScore, false);
  assert.equal(d.result, null);
});

test("live with a 0-0 score still reads as a live score, not pending", () => {
  const d = deriveMatchScore(row({ status: "live", home_goals: 0, away_goals: 0 }));
  assert.deepEqual(d.live, { home: 0, away: 0, minute: null });
  assert.equal(d.liveNoScore, false);
});

test("live but the feed sent no score: liveNoScore, no live object", () => {
  // The CIV vs ECU case — provider reports IN_PLAY with null goals.
  const d = deriveMatchScore(row({ status: "live", home_goals: null, away_goals: null }));
  assert.equal(d.live, null);
  assert.equal(d.liveNoScore, true);
  assert.equal(d.result, null);
  assert.equal(d.isOver, false);
});

test("liveAllowed=false (stale live window) suppresses both live and liveNoScore", () => {
  const d = deriveMatchScore(
    row({ status: "live", home_goals: null, away_goals: null }),
    { liveAllowed: false },
  );
  assert.equal(d.live, null);
  assert.equal(d.liveNoScore, false);
});

test("finished with a score: result, not live or liveNoScore", () => {
  const d = deriveMatchScore(
    row({ status: "finished", home_goals: 2, away_goals: 1, advanced_code: "CIV" }),
  );
  assert.deepEqual(d.result, { home: 2, away: 1, advancedCode: "CIV" });
  assert.equal(d.live, null);
  assert.equal(d.liveNoScore, false);
  assert.equal(d.isOver, true);
});

test("a finished match with no score is never treated as live-pending", () => {
  const d = deriveMatchScore(row({ status: "finished", home_goals: null, away_goals: null }));
  assert.equal(d.result, null);
  assert.equal(d.live, null);
  assert.equal(d.liveNoScore, false);
  assert.equal(d.isOver, true);
});
