import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURES } from "./fixtures.ts";
import { teamByCode } from "../lib/fifa.ts";

test("there are exactly 104 fixtures, 72 group + 32 knockout", () => {
  assert.equal(FIXTURES.length, 104);
  const group = FIXTURES.filter((f) => f.stage === "group");
  assert.equal(group.length, 72);
  assert.equal(FIXTURES.length - group.length, 32);
});

test("match numbers are 1..104, unique and chronological", () => {
  const nums = FIXTURES.map((f) => f.matchNumber);
  assert.deepEqual(nums, Array.from({ length: 104 }, (_, i) => i + 1));
  for (let i = 1; i < FIXTURES.length; i++) {
    assert.ok(
      FIXTURES[i - 1].kickoffAt <= FIXTURES[i].kickoffAt,
      "fixtures must be sorted by kickoff",
    );
  }
});

test("every group fixture has two known teams with renderable flags", () => {
  for (const f of FIXTURES.filter((f) => f.stage === "group")) {
    assert.ok(f.groupLabel, `match ${f.matchNumber} missing group label`);
    for (const code of [f.homeCode, f.awayCode]) {
      assert.ok(code, `group match ${f.matchNumber} missing a team code`);
      assert.ok(
        teamByCode(code),
        `group match ${f.matchNumber} has unknown code ${code}`,
      );
    }
  }
});

test("every knockout fixture uses placeholder labels, not codes", () => {
  for (const f of FIXTURES.filter((f) => f.stage !== "group")) {
    assert.equal(f.homeCode, null);
    assert.equal(f.awayCode, null);
    assert.equal(f.groupLabel, null);
    assert.ok(f.homeLabel && f.awayLabel, `match ${f.matchNumber} missing labels`);
  }
});

test("every kickoff is a valid UTC timestamp", () => {
  for (const f of FIXTURES) {
    assert.ok(
      !Number.isNaN(Date.parse(f.kickoffAt)),
      `match ${f.matchNumber} has invalid kickoff ${f.kickoffAt}`,
    );
  }
});
