/**
 * Live-window helper for the score poller.
 *
 * One API request returns every in-play match at once, so the poller only needs
 * to know WHEN to spend a request: it polls while "now" falls inside any match's
 * expected live window (the union of per-match windows). Knockout windows include
 * extra time + penalties, and 2026's summer cooling breaks are budgeted in, so we
 * keep polling right up to a late final whistle.
 *
 * pollIfDue (src/lib/sync.ts) consumes expectedMatchWindow + mergeWindows; the
 * every-minute cron plus a 30 s de-dupe floor there sets the actual cadence.
 */

import type { Match, Stage } from "./types.ts";

export interface PollingConfig {
  /** Start polling this many minutes before kickoff (to catch the start). */
  preKickoffBufferMin: number;
  /** Keep polling this many minutes after the expected end (long stoppages). */
  postMatchBufferMin: number;
  /** Base wall-clock length of a normal match (90' + HT + stoppage). */
  normalMatchMin: number;
  /** Base wall-clock length of a knockout (+ extra time + penalties). */
  knockoutMatchMin: number;
  /**
   * Length of a single cooling / water break. In 2026's summer heat these are
   * likely (one per half when it's hot), so we budget for them as if they
   * always happen — two in regulation, plus two more across extra time.
   */
  coolingBreakMin: number;
}

export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  preKickoffBufferMin: 5,
  // A normal match: 90' play + ~15' halftime + ~10' stoppage ≈ 115'.
  normalMatchMin: 115,
  postMatchBufferMin: 5,
  // A knockout that goes the distance: ~115' + ~5' break + 30' extra time
  // + ~5' ET stoppage/breaks + ~15' penalties ≈ 170'. We always budget for
  // this worst case because we can't know in advance whether ET/pens happen,
  // and we must keep polling to catch the real finish.
  knockoutMatchMin: 170,
  // ~3' per cooling break (2026 summer heat). Added on top of the base length.
  coolingBreakMin: 3,
};

/** A [start, end) interval in epoch milliseconds. */
export interface Window {
  startMs: number;
  endMs: number;
}

/** Knockout stages can run to extra time and penalties. */
export function isKnockoutStage(stage: Stage): boolean {
  return stage !== "group";
}

/** The expected live window for a single match, including buffers. */
export function expectedMatchWindow(
  match: Pick<Match, "kickoffAt" | "stage">,
  config: PollingConfig = DEFAULT_POLLING_CONFIG,
): Window {
  const kickoffMs = Date.parse(match.kickoffAt);
  if (Number.isNaN(kickoffMs)) {
    throw new RangeError(`invalid kickoffAt: ${match.kickoffAt}`);
  }
  const knockout = isKnockoutStage(match.stage);
  const baseMin = knockout ? config.knockoutMatchMin : config.normalMatchMin;
  // Two cooling breaks in regulation; two more if the match has extra time.
  const coolingMin = (knockout ? 4 : 2) * config.coolingBreakMin;
  const lengthMin = baseMin + coolingMin;
  return {
    startMs: kickoffMs - config.preKickoffBufferMin * 60_000,
    endMs: kickoffMs + (lengthMin + config.postMatchBufferMin) * 60_000,
  };
}

/**
 * Merge overlapping windows into their union. Windows separated by a gap no
 * larger than `gapMergeMin` are also merged (to avoid stop/start churn).
 */
export function mergeWindows(windows: Window[], gapMergeMin = 0): Window[] {
  if (windows.length === 0) return [];
  const gapMs = gapMergeMin * 60_000;
  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs);
  const merged: Window[] = [{ ...sorted[0] }];
  for (const w of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (w.startMs <= last.endMs + gapMs) {
      last.endMs = Math.max(last.endMs, w.endMs);
    } else {
      merged.push({ ...w });
    }
  }
  return merged;
}
