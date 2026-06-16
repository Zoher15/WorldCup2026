/**
 * Derives the *current tournament phase* from the fixture schedule and the
 * clock. The phase drives a subtle, page-wide colour shift (see the
 * `[data-phase="…"]` rules appended to globals.css): the group stage keeps the
 * current warm look, the knockouts cool and deepen as the field narrows, and
 * the final weekend cranks the sunburst with a gold layer.
 *
 * Pure and dependency-light so it runs in the layout server component (no DB
 * call — the schedule is static fixture data) and is trivially testable.
 */

import { FIXTURES, type Fixture } from "../data/fixtures.ts";
import type { Stage } from "./types.ts";

/**
 * The visual phases. Fewer buckets than the seven DB `Stage`s: `third_place`
 * shares the final weekend's look (it kicks off the day before the final), so
 * it folds into `final`.
 */
export type TournamentPhase = "group" | "r32" | "r16" | "qf" | "sf" | "final";

/** All phases in chronological order — the source of truth for ordering. */
export const PHASE_ORDER: TournamentPhase[] = [
  "group",
  "r32",
  "r16",
  "qf",
  "sf",
  "final",
];

/** Map a fixture `Stage` to its visual phase bucket. */
function stageToPhase(stage: Stage): TournamentPhase {
  switch (stage) {
    case "group":
      return "group";
    case "round_of_32":
      return "r32";
    case "round_of_16":
      return "r16";
    case "quarter_final":
      return "qf";
    case "semi_final":
      return "sf";
    case "third_place":
    case "final":
      return "final";
  }
}

/**
 * The phase that "owns" a given moment: the latest phase whose first kickoff
 * has already happened (so the page deepens the instant a round opens), with a
 * sensible default of `group` before the tournament starts.
 *
 * Ties (two phases sharing an earliest kickoff — shouldn't happen, but be
 * safe) resolve to the later phase via PHASE_ORDER, since by the time a round
 * begins the previous one is effectively done.
 *
 * @param now      The moment to evaluate (defaults to the real clock).
 * @param fixtures The schedule (defaults to the bundled FIXTURES; injectable
 *                 for tests).
 */
export function currentPhase(
  now: Date = new Date(),
  fixtures: readonly Fixture[] = FIXTURES,
): TournamentPhase {
  const nowMs = now.getTime();

  // Earliest kickoff per phase, in ms. A phase with no fixtures is absent.
  const firstKickoff = new Map<TournamentPhase, number>();
  for (const f of fixtures) {
    const phase = stageToPhase(f.stage);
    const ms = Date.parse(f.kickoffAt);
    if (Number.isNaN(ms)) continue;
    const seen = firstKickoff.get(phase);
    if (seen === undefined || ms < seen) firstKickoff.set(phase, ms);
  }

  // Walk phases newest→oldest; the first one already underway wins. Before any
  // kickoff (or with an empty schedule) we fall through to the default below.
  for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
    const phase = PHASE_ORDER[i];
    const start = firstKickoff.get(phase);
    if (start !== undefined && nowMs >= start) return phase;
  }

  return "group";
}
