import { test } from "node:test";
import assert from "node:assert/strict";
import {
  upsetCallerIds,
  computeNewUpsets,
  type UpsetMatch,
  type UpsetPick,
} from "./upsets.ts";

const e = (userId: string, outcome: number, isBot = false) => ({
  userId,
  outcome,
  isBot,
});

test("one right against a wrong crowd is an upset call", () => {
  const ids = upsetCallerIds([
    e("a", 5),
    e("b", 0),
    e("c", 0),
    e("d", 2),
    e("f", 0),
  ]);
  assert.deepEqual([...ids], ["a"]);
});

test("two right callers can share an upset in a big group", () => {
  const entries = [
    e("a", 5),
    e("b", 5),
    ...["c", "d", "e", "f"].map((id) => e(id, 0)),
  ];
  assert.deepEqual([...upsetCallerIds(entries)].sort(), ["a", "b"]);
});

test("no upset when the right-callers aren't a clear minority", () => {
  // 2 of 4 right — that's just a split, not a consensus defied.
  assert.equal(upsetCallerIds([e("a", 5), e("b", 5), e("c", 0), e("d", 0)]).size, 0);
});

test("no upset when everyone called it", () => {
  assert.equal(upsetCallerIds([e("a", 5), e("b", 5), e("c", 5)]).size, 0);
});

test("no upset when everyone missed", () => {
  assert.equal(upsetCallerIds([e("a", 0), e("b", 2), e("c", 0)]).size, 0);
});

test("too few pickers can't form a consensus", () => {
  assert.equal(upsetCallerIds([e("a", 5), e("b", 0)]).size, 0);
});

test("partial outcome points (2) don't count as calling it", () => {
  const ids = upsetCallerIds([e("a", 5), e("b", 2), e("c", 2), e("d", 0)]);
  assert.deepEqual([...ids], ["a"]);
});

test("the bot neither earns nor shapes an upset", () => {
  // Without the bot: 1 right of 2 pickers -> too few. The bot's wrong 0-0
  // must not tip it into an upset.
  assert.equal(
    upsetCallerIds([e("a", 5), e("b", 0), e("bot", 0, true)]).size,
    0,
  );
  // And a "right" bot never appears in the result.
  const ids = upsetCallerIds([e("a", 5), e("bot", 5, true), e("b", 0), e("c", 0)]);
  assert.deepEqual([...ids], ["a"]);
});

// ── computeNewUpsets ─────────────────────────────────────────────────────────

/** A home-win fixture (2–1) unless overridden; label is the id for easy asserts. */
const upsetMatch = (id: string, kickoffMs: number, home = 2, away = 1): UpsetMatch => ({
  id,
  kickoffMs,
  label: id,
  stage: "group",
  homeCode: "AAA",
  awayCode: "BBB",
  result: { home, away, advancedCode: null },
});
const pick = (home: number, away: number): UpsetPick => ({ home, away, advancePick: null });
/** Map<userId, pick> from a plain object. */
const picksFor = (o: Record<string, UpsetPick>) => new Map(Object.entries(o));
/** Map<groupId, Set<userId>> from a plain object. */
const groupsOf = (o: Record<string, string[]>) =>
  new Map(Object.entries(o).map(([g, ids]) => [g, new Set(ids)]));

test("computeNewUpsets credits the lone right-caller against a wrong crowd", () => {
  // 2–1 home win: A called the direction (1–0), B and C backed the away side.
  const byUser = computeNewUpsets(
    [upsetMatch("m1", 100)],
    new Map([["m1", picksFor({ a: pick(1, 0), b: pick(0, 1), c: pick(0, 2) })]]),
    groupsOf({ g1: ["a", "b", "c"] }),
    new Map([["g1", "Family"]]),
  );
  assert.deepEqual(byUser.get("a"), [
    { matchId: "m1", match: "m1", group: "Family", kickoffMs: 100 },
  ]);
  assert.equal(byUser.has("b"), false);
  assert.equal(byUser.has("c"), false);
});

test("computeNewUpsets records a call that defied several groups only once", () => {
  // A is in both groups and called 2–1 right; each group's others got it wrong.
  const byUser = computeNewUpsets(
    [upsetMatch("m1", 100)],
    new Map([
      [
        "m1",
        picksFor({
          a: pick(1, 0),
          b: pick(0, 1),
          c: pick(0, 2),
          d: pick(0, 1),
          e: pick(0, 3),
        }),
      ],
    ]),
    groupsOf({ g1: ["a", "b", "c"], g2: ["a", "d", "e"] }),
    new Map([["g1", "Family"], ["g2", "Work"]]),
  );
  const calls = byUser.get("a");
  assert.equal(calls?.length, 1);
  assert.equal(calls?.[0].matchId, "m1");
});

test("computeNewUpsets returns each member's calls newest-first", () => {
  const byUser = computeNewUpsets(
    [upsetMatch("m1", 100), upsetMatch("m2", 200)],
    new Map([
      ["m1", picksFor({ a: pick(1, 0), b: pick(0, 1), c: pick(0, 1) })],
      ["m2", picksFor({ a: pick(2, 0), b: pick(0, 1), c: pick(0, 3) })],
    ]),
    groupsOf({ g1: ["a", "b", "c"] }),
    new Map([["g1", "Family"]]),
  );
  assert.deepEqual(
    byUser.get("a")?.map((c) => c.matchId),
    ["m2", "m1"],
  );
});

test("computeNewUpsets finds nothing when a group is too small to form a consensus", () => {
  const byUser = computeNewUpsets(
    [upsetMatch("m1", 100)],
    new Map([["m1", picksFor({ a: pick(1, 0), b: pick(0, 1) })]]),
    groupsOf({ g1: ["a", "b"] }),
    new Map([["g1", "Family"]]),
  );
  assert.equal(byUser.size, 0);
});

test("computeNewUpsets skips a match with no loaded picks", () => {
  const byUser = computeNewUpsets(
    [upsetMatch("m1", 100)],
    new Map(),
    groupsOf({ g1: ["a", "b", "c"] }),
    new Map([["g1", "Family"]]),
  );
  assert.equal(byUser.size, 0);
});
