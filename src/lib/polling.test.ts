import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expectedMatchWindow,
  mergeWindows,
  planDay,
  planSchedule,
  isWithinLiveWindows,
  isKnockoutStage,
  DEFAULT_POLLING_CONFIG,
  type Window,
} from "./polling.ts";
import type { Match, Stage } from "./types.ts";

const cfg = DEFAULT_POLLING_CONFIG;

const m = (kickoffAt: string, stage: Stage = "group") =>
  ({ kickoffAt, stage }) as Pick<Match, "kickoffAt" | "stage">;

const minutes = (w: Window) => (w.endMs - w.startMs) / 60_000;

test("knockout stages are detected", () => {
  assert.equal(isKnockoutStage("group"), false);
  for (const s of [
    "round_of_32",
    "round_of_16",
    "quarter_final",
    "semi_final",
    "third_place",
    "final",
  ] as Stage[]) {
    assert.equal(isKnockoutStage(s), true);
  }
});

test("knockout window is longer than a normal match (extra time + penalties)", () => {
  const normal = expectedMatchWindow(m("2026-06-15T18:00:00Z", "group"));
  const ko = expectedMatchWindow(m("2026-06-15T18:00:00Z", "final"));
  assert.equal(
    minutes(normal),
    cfg.normalMatchMin + cfg.preKickoffBufferMin + cfg.postMatchBufferMin,
  );
  assert.equal(
    minutes(ko),
    cfg.knockoutMatchMin + cfg.preKickoffBufferMin + cfg.postMatchBufferMin,
  );
  assert.ok(minutes(ko) > minutes(normal));
});

test("invalid kickoff is rejected", () => {
  assert.throws(() => expectedMatchWindow(m("not-a-date")), RangeError);
});

test("overlapping windows merge into their union", () => {
  const merged = mergeWindows([
    { startMs: 0, endMs: 100 },
    { startMs: 50, endMs: 120 },
    { startMs: 200, endMs: 300 },
  ]);
  assert.deepEqual(merged, [
    { startMs: 0, endMs: 120 },
    { startMs: 200, endMs: 300 },
  ]);
});

test("simultaneous matches cost the same as one (shared polls)", () => {
  // two matches kicking off at the same time -> one merged window
  const simultaneous = planDay("2026-06-20", [
    m("2026-06-20T18:00:00Z"),
    m("2026-06-20T18:00:00Z"),
  ]);
  const single = planDay("2026-06-20", [m("2026-06-20T18:00:00Z")]);
  assert.equal(simultaneous.liveWindows.length, 1);
  assert.equal(simultaneous.estimatedRequests, single.estimatedRequests);
  assert.equal(simultaneous.intervalSec, single.intervalSec);
});

test("a quiet day with one match polls near the floor and stays within budget", () => {
  const plan = planDay("2026-06-20", [m("2026-06-20T18:00:00Z")]);
  assert.equal(plan.matchCount, 1);
  assert.ok(plan.estimatedRequests <= plan.liveBudget);
  assert.ok(plan.intervalSec <= cfg.maxIntervalSec);
  assert.equal(plan.degraded, false);
});

test("a busy day with spread-out matches is flagged degraded but stays in budget", () => {
  const plan = planDay("2026-06-20", [
    m("2026-06-20T12:00:00Z"),
    m("2026-06-20T15:00:00Z"),
    m("2026-06-20T18:00:00Z"),
    m("2026-06-20T21:00:00Z"),
  ]);
  assert.equal(plan.liveWindows.length, 4); // no overlap
  assert.ok(plan.estimatedRequests <= plan.liveBudget, "must not exceed budget");
  assert.ok(plan.intervalSec > cfg.maxIntervalSec, "interval stretched to fit");
  assert.equal(plan.degraded, true);
});

test("the plan never exceeds the live budget across many shapes", () => {
  const days = [
    [m("2026-06-20T18:00:00Z")],
    [m("2026-06-20T12:00:00Z"), m("2026-06-20T12:00:00Z")],
    [
      m("2026-06-20T12:00:00Z"),
      m("2026-06-20T15:00:00Z"),
      m("2026-06-20T18:00:00Z"),
      m("2026-06-20T21:00:00Z"),
    ],
    [m("2026-07-19T18:00:00Z", "final")],
    [
      m("2026-07-10T18:00:00Z", "semi_final"),
      m("2026-07-11T18:00:00Z", "semi_final"),
    ],
  ];
  for (const matches of days) {
    const plan = planDay("d", matches);
    assert.ok(
      plan.estimatedRequests <= plan.liveBudget,
      `requests ${plan.estimatedRequests} > budget ${plan.liveBudget}`,
    );
    assert.ok(plan.intervalSec >= cfg.minIntervalSec);
  }
});

test("empty day produces an empty plan", () => {
  const plan = planDay("2026-06-20", []);
  assert.equal(plan.estimatedRequests, 0);
  assert.equal(plan.intervalSec, 0);
  assert.equal(plan.liveMinutes, 0);
  assert.equal(plan.degraded, false);
});

test("planSchedule buckets matches by UTC day and sorts", () => {
  const plans = planSchedule([
    m("2026-06-21T18:00:00Z"),
    m("2026-06-20T18:00:00Z"),
    m("2026-06-20T21:00:00Z"),
    // 23:30Z + buffers crosses midnight but is attributed to its kickoff day
    m("2026-06-22T23:30:00Z"),
  ]);
  assert.deepEqual(
    plans.map((p) => p.date),
    ["2026-06-20", "2026-06-21", "2026-06-22"],
  );
  assert.equal(plans[0].matchCount, 2);
  assert.equal(plans[1].matchCount, 1);
});

test("isWithinLiveWindows reflects the merged windows", () => {
  const plan = planDay("2026-06-20", [m("2026-06-20T18:00:00Z")]);
  const kickoff = Date.parse("2026-06-20T18:00:00Z");
  assert.equal(isWithinLiveWindows(kickoff + 30 * 60_000, plan), true); // 30' in
  assert.equal(isWithinLiveWindows(kickoff - 60 * 60_000, plan), false); // hour before
  assert.equal(isWithinLiveWindows(kickoff + 6 * 3600_000, plan), false); // long after
});
