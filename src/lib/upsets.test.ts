import { test } from "node:test";
import assert from "node:assert/strict";
import { upsetCallerIds } from "./upsets.ts";

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
