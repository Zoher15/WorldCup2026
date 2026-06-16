import { test } from "node:test";
import assert from "node:assert/strict";
import type { Fixture } from "../data/fixtures.ts";
import {
  currentPhase,
  PHASE_ORDER,
  type TournamentPhase,
} from "./tournament-phase.ts";

/** A minimal fixture builder — only the fields currentPhase reads. */
function fx(stage: Fixture["stage"], kickoffAt: string): Fixture {
  return {
    matchNumber: 0,
    stage,
    groupLabel: null,
    homeCode: null,
    awayCode: null,
    homeLabel: null,
    awayLabel: null,
    kickoffAt,
    venue: "",
  };
}

// A compact stand-in schedule with one fixture per stage, in order.
const schedule: Fixture[] = [
  fx("group", "2026-06-11T19:00:00.000Z"),
  fx("round_of_32", "2026-06-28T19:00:00.000Z"),
  fx("round_of_16", "2026-07-04T17:00:00.000Z"),
  fx("quarter_final", "2026-07-09T20:00:00.000Z"),
  fx("semi_final", "2026-07-14T19:00:00.000Z"),
  fx("third_place", "2026-07-18T21:00:00.000Z"),
  fx("final", "2026-07-19T19:00:00.000Z"),
];

const at = (iso: string) => currentPhase(new Date(iso), schedule);

test("defaults to group before the tournament starts", () => {
  assert.equal(at("2026-06-01T00:00:00.000Z"), "group");
});

test("is group right when the opening match kicks off", () => {
  assert.equal(at("2026-06-11T19:00:00.000Z"), "group");
});

test("stays group through the group stage", () => {
  assert.equal(at("2026-06-20T12:00:00.000Z"), "group");
});

test("advances to r32 the instant the round of 32 opens", () => {
  assert.equal(at("2026-06-28T19:00:00.000Z"), "r32");
});

test("walks the knockout phases as each round begins", () => {
  assert.equal(at("2026-07-02T00:00:00.000Z"), "r32");
  assert.equal(at("2026-07-05T00:00:00.000Z"), "r16");
  assert.equal(at("2026-07-10T00:00:00.000Z"), "qf");
  assert.equal(at("2026-07-14T20:00:00.000Z"), "sf");
});

test("folds third place into the final weekend", () => {
  // The third-place play-off kicks off the day before the final; both wear the
  // `final` look.
  assert.equal(at("2026-07-18T21:00:00.000Z"), "final");
  assert.equal(at("2026-07-19T19:00:00.000Z"), "final");
});

test("stays final after the tournament ends", () => {
  assert.equal(at("2026-08-01T00:00:00.000Z"), "final");
});

test("returns a phase that exists in PHASE_ORDER", () => {
  const phase = currentPhase(new Date("2026-07-10T00:00:00.000Z"), schedule);
  assert.ok(PHASE_ORDER.includes(phase));
});

test("ignores fixtures with an unparseable kickoff", () => {
  const broken: Fixture[] = [
    fx("group", "2026-06-11T19:00:00.000Z"),
    fx("round_of_32", "not-a-date"),
  ];
  // The bad r32 row is skipped, so a date well past it still reads as group.
  assert.equal(currentPhase(new Date("2026-07-01T00:00:00.000Z"), broken), "group");
});

test("falls back to group for an empty schedule", () => {
  assert.equal(currentPhase(new Date("2026-07-10T00:00:00.000Z"), []), "group");
});

test("derives the live phase from the real bundled fixtures", () => {
  // Sanity: with the actual FIXTURES, group-stage dates read as group and the
  // final day reads as final. No `schedule` override here.
  const phases: TournamentPhase[] = [
    currentPhase(new Date("2026-06-15T00:00:00.000Z")),
    currentPhase(new Date("2026-07-19T20:00:00.000Z")),
  ];
  assert.equal(phases[0], "group");
  assert.equal(phases[1], "final");
});
