import { test } from "node:test";
import assert from "node:assert/strict";
import { openMatchDays, dueMatchDaysForNudge } from "./notify-windows.ts";
import { windowOpensAt } from "./prediction-rules.ts";

const m = (kickoff_at: string) => ({ kickoff_at });
const iso = (kickoff: string) => new Date(windowOpensAt(kickoff)).toISOString();
const HOUR = 60 * 60 * 1000;

test("openMatchDays returns every open day, earliest first", () => {
  // Today is June 11 13:52 UTC. Today's games (kickoff 19:00) opened yesterday;
  // tomorrow's games (kickoff June 12) opened today — both are open at once.
  const today = "2026-06-11T19:00:00.000Z";
  const tomorrow = "2026-06-12T19:00:00.000Z";
  const now = new Date("2026-06-11T13:52:00.000Z");

  const open = openMatchDays([m(tomorrow), m(today)], now);

  assert.equal(open.length, 2);
  // Earliest-opening first: today's day (opened yesterday) before tomorrow's.
  assert.equal(open[0].matchDay, iso(today));
  assert.equal(open[1].matchDay, iso(tomorrow));
});

test("openMatchDays groups a day's games together under one open instant", () => {
  const early = "2026-06-12T16:00:00.000Z";
  const late = "2026-06-12T19:00:00.000Z";
  const now = new Date("2026-06-11T13:52:00.000Z");

  const open = openMatchDays([m(early), m(late)], now);

  assert.equal(open.length, 1);
  assert.equal(open[0].matches.length, 2);
  assert.equal(open[0].matchDay, iso(early));
});

test("openMatchDays excludes a day whose first kickoff has passed", () => {
  const kickoff = "2026-06-11T19:00:00.000Z";
  // Now is after kickoff — the day is no longer pre-kickoff, so not "open".
  const now = new Date("2026-06-11T19:30:00.000Z");

  assert.equal(openMatchDays([m(kickoff)], now).length, 0);
});

test("openMatchDays excludes a day whose window hasn't opened yet", () => {
  const kickoff = "2026-06-20T19:00:00.000Z";
  // Now is well before this far-off day's window opens.
  const now = new Date("2026-06-11T13:52:00.000Z");

  assert.equal(openMatchDays([m(kickoff)], now).length, 0);
});

test("dueMatchDaysForNudge returns a day inside the lead window before its first kickoff", () => {
  const kickoff = "2026-06-11T19:00:00.000Z";
  const now = new Date("2026-06-11T18:30:00.000Z"); // 30 min out
  assert.equal(dueMatchDaysForNudge([m(kickoff)], now, HOUR).length, 1);
});

test("dueMatchDaysForNudge includes a day exactly at the lead boundary", () => {
  const kickoff = "2026-06-11T19:00:00.000Z";
  const now = new Date("2026-06-11T18:00:00.000Z"); // exactly 1h out
  assert.equal(dueMatchDaysForNudge([m(kickoff)], now, HOUR).length, 1);
});

test("dueMatchDaysForNudge excludes a day still more than the lead window away", () => {
  const kickoff = "2026-06-11T19:00:00.000Z";
  const now = new Date("2026-06-11T17:30:00.000Z"); // 90 min out
  assert.equal(dueMatchDaysForNudge([m(kickoff)], now, HOUR).length, 0);
});

test("dueMatchDaysForNudge excludes a day whose first kickoff has already passed", () => {
  const kickoff = "2026-06-11T19:00:00.000Z";
  const now = new Date("2026-06-11T19:00:00.000Z"); // exactly first kickoff
  assert.equal(dueMatchDaysForNudge([m(kickoff)], now, HOUR).length, 0);
});

test("dueMatchDaysForNudge fires once for the whole day, timed off the FIRST kickoff", () => {
  // The day's first game is at 19:00, a later one at 22:00. An hour before 19:00
  // the day is due — as ONE group carrying both games (not one per kickoff).
  const first = "2026-06-11T19:00:00.000Z";
  const later = "2026-06-11T22:00:00.000Z";
  const now = new Date("2026-06-11T18:15:00.000Z");

  const due = dueMatchDaysForNudge([m(first), m(later)], now, HOUR);
  assert.equal(due.length, 1);
  assert.equal(due[0].matches.length, 2);
});

test("dueMatchDaysForNudge is not yet due an hour before a LATER kickoff only", () => {
  // The only game is at 22:00; at 21:15 it'd be due, but at 18:15 (an hour
  // before an earlier day's slot) this day hasn't entered its lead window.
  const later = "2026-06-11T22:00:00.000Z";
  const now = new Date("2026-06-11T18:15:00.000Z");
  assert.equal(dueMatchDaysForNudge([m(later)], now, HOUR).length, 0);
});
