import { test } from "node:test";
import assert from "node:assert/strict";
import { dueMatchDaysForDigest } from "./notify-windows.ts";
import { windowOpensAt } from "./prediction-rules.ts";

const m = (kickoff_at: string) => ({ kickoff_at });
const iso = (kickoff: string) => new Date(windowOpensAt(kickoff)).toISOString();
const HOUR = 60 * 60 * 1000;

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
