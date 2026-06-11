import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expectedMatchWindow,
  mergeWindows,
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
  const buffers = cfg.preKickoffBufferMin + cfg.postMatchBufferMin;
  const normal = expectedMatchWindow(m("2026-06-15T18:00:00Z", "group"));
  const ko = expectedMatchWindow(m("2026-06-15T18:00:00Z", "final"));
  // 2 cooling breaks in regulation, 4 across a knockout that reaches ET.
  assert.equal(
    minutes(normal),
    cfg.normalMatchMin + 2 * cfg.coolingBreakMin + buffers,
  );
  assert.equal(
    minutes(ko),
    cfg.knockoutMatchMin + 4 * cfg.coolingBreakMin + buffers,
  );
  assert.ok(minutes(ko) > minutes(normal));
});

test("cooling breaks lengthen the live window", () => {
  const noCooling = { ...cfg, coolingBreakMin: 0 };
  const withCooling = { ...cfg, coolingBreakMin: 3 };
  const base = minutes(expectedMatchWindow(m("2026-06-20T18:00:00Z"), noCooling));
  const longer = minutes(
    expectedMatchWindow(m("2026-06-20T18:00:00Z"), withCooling),
  );
  assert.ok(longer > base, "cooling breaks extend the window");
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

test("simultaneous matches collapse to a single window (shared polls)", () => {
  const merged = mergeWindows([
    expectedMatchWindow(m("2026-06-20T18:00:00Z")),
    expectedMatchWindow(m("2026-06-20T18:00:00Z")),
  ]);
  assert.equal(merged.length, 1);
});

test("an empty set of windows merges to nothing", () => {
  assert.deepEqual(mergeWindows([]), []);
});
