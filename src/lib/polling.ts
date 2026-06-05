/**
 * Smart polling planner for live scores.
 *
 * The live-score API has a fixed DAILY request budget (e.g. 100/day on the
 * API-Football free tier, which resets at 00:00 UTC). We want to poll often
 * enough to feel live, but never blow the budget — because exhausting it would
 * lock us out mid-match and we'd miss final whistles.
 *
 * The plan for each day is computed in two steps, exactly as described:
 *
 *   1. Predict the total PERIOD we need to poll over that day. One API request
 *      returns *all* in-play matches at once, so the cost driver is the UNION
 *      of each match's expected live window — overlapping/simultaneous matches
 *      share a single poll. Knockout windows include extra time + penalties.
 *
 *   2. From that period and the day's budget, derive the polling FREQUENCY:
 *      the fastest interval that still fits the budget (never exceeding it),
 *      bounded by a sensible floor (no point polling faster than the API
 *      updates) and flagged as "degraded" if we can't be as responsive as
 *      we'd like within the free budget.
 *
 * Days are bucketed by UTC date to match the quota reset.
 */

import type { Match, Stage } from "./types.ts";

export interface PollingConfig {
  /** Total API requests available per UTC day. */
  dailyBudget: number;
  /** Requests held back for non-live needs (fixtures, standings refresh). */
  reservedRequests: number;
  /** Never poll faster than this (the API updates roughly every 15s). */
  minIntervalSec: number;
  /** Target responsiveness — slower than this is flagged as "degraded". */
  maxIntervalSec: number;
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
  /** Merge live windows separated by a gap no larger than this. */
  gapMergeMin: number;
}

export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  dailyBudget: 100, // API-Football free tier
  reservedRequests: 10,
  minIntervalSec: 30,
  maxIntervalSec: 120, // we'd like to refresh at least every 2 minutes
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
  gapMergeMin: 0,
};

/** A [start, end) interval in epoch milliseconds. */
export interface Window {
  startMs: number;
  endMs: number;
}

export interface DayPlan {
  /** UTC date key, "YYYY-MM-DD". */
  date: string;
  matchCount: number;
  /** Merged (union) live windows we intend to poll across. */
  liveWindows: Window[];
  /** Total minutes across the union of live windows. */
  liveMinutes: number;
  /** Chosen polling interval in seconds (0 if nothing to poll). */
  intervalSec: number;
  /** Estimated requests this plan will consume. */
  estimatedRequests: number;
  /** Budget available for live polling (dailyBudget − reservedRequests). */
  liveBudget: number;
  /**
   * True when we cannot poll as often as maxIntervalSec within the budget —
   * i.e. a busy day where the free tier feels laggy and a paid month would help.
   */
  degraded: boolean;
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

function totalSeconds(windows: Window[]): number {
  return windows.reduce((sum, w) => sum + (w.endMs - w.startMs) / 1000, 0);
}

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function countRequests(windows: Window[], intervalSec: number): number {
  return windows.reduce(
    (sum, w) => sum + Math.ceil((w.endMs - w.startMs) / 1000 / intervalSec),
    0,
  );
}

/**
 * Build a polling plan for a single UTC day's matches.
 *
 * Guarantees `estimatedRequests <= liveBudget`: we choose the fastest interval
 * that fits the budget, never one that would exceed it.
 */
export function planDay(
  date: string,
  matches: Pick<Match, "kickoffAt" | "stage">[],
  config: PollingConfig = DEFAULT_POLLING_CONFIG,
): DayPlan {
  const liveBudget = Math.max(1, config.dailyBudget - config.reservedRequests);

  if (matches.length === 0) {
    return {
      date,
      matchCount: 0,
      liveWindows: [],
      liveMinutes: 0,
      intervalSec: 0,
      estimatedRequests: 0,
      liveBudget,
      degraded: false,
    };
  }

  const merged = mergeWindows(
    matches.map((m) => expectedMatchWindow(m, config)),
    config.gapMergeMin,
  );
  const liveSec = totalSeconds(merged);

  // Slowest-acceptable lower bound: the interval at which we'd exactly spend
  // the budget. Polling faster than this would exceed the budget.
  const intervalFromBudget = liveSec / liveBudget;
  let intervalSec = roundUpTo(
    Math.max(config.minIntervalSec, intervalFromBudget),
    5,
  );

  // Rounding and the per-window ceiling can nudge us over budget; widen the
  // interval until we fit. (Bounded: each step strictly lowers the count.)
  let estimatedRequests = countRequests(merged, intervalSec);
  while (estimatedRequests > liveBudget) {
    intervalSec += 5;
    estimatedRequests = countRequests(merged, intervalSec);
  }

  return {
    date,
    matchCount: matches.length,
    liveWindows: merged,
    liveMinutes: Math.round(liveSec / 60),
    intervalSec,
    estimatedRequests,
    liveBudget,
    degraded: intervalSec > config.maxIntervalSec,
  };
}

/** Format an epoch-ms instant as its UTC date key, "YYYY-MM-DD". */
function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Plan polling for a whole schedule, one DayPlan per UTC day that has matches.
 * Each match is attributed to the UTC day of its kickoff (aligning with the
 * API's 00:00-UTC quota reset). Results are sorted by date.
 */
export function planSchedule(
  matches: Pick<Match, "kickoffAt" | "stage">[],
  config: PollingConfig = DEFAULT_POLLING_CONFIG,
): DayPlan[] {
  const byDay = new Map<string, Pick<Match, "kickoffAt" | "stage">[]>();
  for (const m of matches) {
    const ms = Date.parse(m.kickoffAt);
    if (Number.isNaN(ms)) throw new RangeError(`invalid kickoffAt: ${m.kickoffAt}`);
    const key = utcDateKey(ms);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(m);
    else byDay.set(key, [m]);
  }
  return [...byDay.keys()]
    .sort()
    .map((date) => planDay(date, byDay.get(date)!, config));
}

/** Whether a given instant falls inside any of a plan's live windows. */
export function isWithinLiveWindows(ms: number, plan: DayPlan): boolean {
  return plan.liveWindows.some((w) => ms >= w.startMs && ms < w.endMs);
}
