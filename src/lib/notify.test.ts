import { test } from "node:test";
import assert from "node:assert/strict";
import { dueMatchDaysForDigest, dueRoundOpens } from "./notify-windows.ts";
import { windowOpensAt, roundOpensByStage } from "./prediction-rules.ts";
import type { Stage } from "./types.ts";

const m = (kickoff_at: string) => ({ kickoff_at });
const iso = (kickoff: string) => new Date(windowOpensAt(kickoff)).toISOString();
const HOUR = 60 * 60 * 1000;

/** A knockout fixture for the round-open broadcast tests. */
const ko = (
  stage: Stage,
  kickoff_at: string,
  home_code: string | null = "AAA",
  away_code: string | null = "BBB",
) => ({ stage, kickoff_at, home_code, away_code });

/** The instant a round opens (the earliest game's day-before window). */
const roundOpen = (stage: Stage, kickoff: string) =>
  roundOpensByStage([{ stage, kickoffAt: kickoff }]).get(stage)!;

test("dueMatchDaysForDigest returns a day inside the lead window before its first kickoff", () => {
  const kickoff = "2026-06-11T19:00:00.000Z";
  const now = new Date("2026-06-11T18:30:00.000Z"); // 30 min out
  assert.equal(dueMatchDaysForDigest([m(kickoff)], now, HOUR).length, 1);
});

test("dueMatchDaysForDigest includes a day exactly at the lead boundary", () => {
  const kickoff = "2026-06-11T19:00:00.000Z";
  const now = new Date("2026-06-11T18:00:00.000Z"); // exactly 1h out
  assert.equal(dueMatchDaysForDigest([m(kickoff)], now, HOUR).length, 1);
});

test("dueMatchDaysForDigest excludes a day still more than the lead window away", () => {
  const kickoff = "2026-06-11T19:00:00.000Z";
  const now = new Date("2026-06-11T17:30:00.000Z"); // 90 min out
  assert.equal(dueMatchDaysForDigest([m(kickoff)], now, HOUR).length, 0);
});

test("dueMatchDaysForDigest excludes a day whose first kickoff has already passed", () => {
  const kickoff = "2026-06-11T19:00:00.000Z";
  const now = new Date("2026-06-11T19:00:00.000Z"); // exactly first kickoff
  assert.equal(dueMatchDaysForDigest([m(kickoff)], now, HOUR).length, 0);
});

test("dueMatchDaysForDigest fires once for the whole day, timed off the FIRST kickoff", () => {
  // The day's first game is at 19:00, a later one at 22:00. An hour before 19:00
  // the day is due — as ONE group carrying both games (not one per kickoff), keyed
  // by the window-open instant.
  const first = "2026-06-11T19:00:00.000Z";
  const later = "2026-06-11T22:00:00.000Z";
  const now = new Date("2026-06-11T18:15:00.000Z");

  const due = dueMatchDaysForDigest([m(first), m(later)], now, HOUR);
  assert.equal(due.length, 1);
  assert.equal(due[0].matches.length, 2);
  assert.equal(due[0].matchDay, iso(first));
});

test("dueMatchDaysForDigest is not yet due an hour before a LATER kickoff only", () => {
  // The only game is at 22:00; at 21:15 it'd be due, but at 18:15 (an hour
  // before an earlier day's slot) this day hasn't entered its lead window.
  const later = "2026-06-11T22:00:00.000Z";
  const now = new Date("2026-06-11T18:15:00.000Z");
  assert.equal(dueMatchDaysForDigest([m(later)], now, HOUR).length, 0);
});

test("dueRoundOpens fires once the round opens, with all its games", () => {
  const first = "2026-06-29T16:00:00.000Z";
  const later = "2026-07-02T20:00:00.000Z";
  const matches = [ko("round_of_32", first), ko("round_of_32", later)];
  const now = new Date(roundOpen("round_of_32", first) + HOUR); // just after open

  const due = dueRoundOpens(matches, now);
  assert.equal(due.length, 1);
  assert.equal(due[0].stage, "round_of_32");
  assert.equal(due[0].matches.length, 2); // the whole round, not one per game
});

test("dueRoundOpens is not due before the round opens", () => {
  const first = "2026-06-29T16:00:00.000Z";
  const now = new Date(roundOpen("round_of_32", first) - HOUR); // an hour early
  assert.equal(dueRoundOpens([ko("round_of_32", first)], now).length, 0);
});

test("dueRoundOpens stops once the round's first game kicks off", () => {
  // Deploying mid-round must not blast a round already underway.
  const first = "2026-06-29T16:00:00.000Z";
  const now = new Date(first); // first game kicking off
  assert.equal(dueRoundOpens([ko("round_of_32", first)], now).length, 0);
});

test("dueRoundOpens waits for the bracket to be fully set (no TBD matchups)", () => {
  // The window can open before the prior round's last game resolves a slot; an
  // unresolved matchup must not be announced.
  const first = "2026-07-05T16:00:00.000Z";
  const now = new Date(roundOpen("round_of_16", first) + HOUR);
  const resolved = ko("round_of_16", first, "ARG", "FRA");
  const tbd = ko("round_of_16", "2026-07-06T20:00:00.000Z", "ENG", null);
  assert.equal(dueRoundOpens([resolved, tbd], now).length, 0);
  // Once that slot resolves, the round is announced.
  const nowFilled = ko("round_of_16", "2026-07-06T20:00:00.000Z", "ENG", "ESP");
  assert.equal(dueRoundOpens([resolved, nowFilled], now).length, 1);
});

test("dueRoundOpens ignores the group stage entirely", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");
  assert.equal(dueRoundOpens([ko("group", "2026-06-20T19:00:00.000Z")], now).length, 0);
});
