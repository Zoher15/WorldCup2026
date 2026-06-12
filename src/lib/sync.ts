import { createAdminClient } from "./supabase/admin";
import { fetchWorldCupMatches } from "./footballdata";
import { resolveFdTeam } from "./fifa";
import { expectedMatchWindow, isKnockoutStage, mergeWindows } from "./polling";
import {
  deriveFdUpdate,
  fdStatusToOurs,
  matchFdToLocal,
} from "./fd-core";
import type { LocalMatchRef } from "./types";

export interface SyncSummary {
  fetched: number;
  updated: number;
  confirmed: number;
  unmatched: number;
  /** How many matches had their live score/status actually move this sync —
   *  the trigger to warm share images even before a result is confirmed. */
  scoreChanges: number;
}

/**
 * Sync World Cup match data from football-data.org into our matches.
 *
 *  - Pulls all WC matches; processes only live/finished ones (the ones with
 *    something to write).
 *  - Links each to a local match by stored external_ref, else by time/teams,
 *    recording the link for next time.
 *  - Writes live status/score; fills in knockout teams once known.
 *  - Auto-confirms results when football-data reports FINISHED/AWARDED.
 *  - Never overwrites an already-confirmed match, so manual admin corrections
 *    always win.
 *
 * football-data's free tier provides final scores (slightly delayed), not a
 * live in-play clock, so `minute` is left null.
 */
export async function syncDay(_date?: string): Promise<SyncSummary> {
  const db = createAdminClient();
  const all = await fetchWorldCupMatches();
  const fixtures = all.filter((m) => {
    const s = fdStatusToOurs(m.status);
    return s === "live" || s === "finished";
  });

  const { data: localRows } = await db
    .from("matches")
    .select(
      "id, external_ref, kickoff_at, stage, home_code, away_code, result_confirmed, status, home_goals, away_goals",
    );
  const locals = localRows ?? [];
  const byId = new Map(locals.map((l) => [l.id, l]));
  const byRef = new Map(
    locals.filter((l) => l.external_ref).map((l) => [l.external_ref, l]),
  );
  const refs: LocalMatchRef[] = locals.map((l) => ({
    id: l.id,
    kickoffAt: l.kickoff_at,
    homeCode: l.home_code,
    awayCode: l.away_code,
  }));

  const summary: SyncSummary = {
    fetched: fixtures.length,
    updated: 0,
    confirmed: 0,
    unmatched: 0,
    scoreChanges: 0,
  };
  const syncedAt = new Date().toISOString();

  // Build one patch per matched fixture, then write them concurrently.
  const patches: { id: string; patch: Record<string, unknown> }[] = [];
  for (const fx of fixtures) {
    const refId = String(fx.id);
    let local = byRef.get(refId);
    if (!local) {
      const matchedId = matchFdToLocal(fx, refs, resolveFdTeam);
      local = matchedId ? byId.get(matchedId) : undefined;
    }
    if (!local) {
      summary.unmatched++;
      continue;
    }
    // Respect manual/earlier confirmations — never clobber a final result.
    if (local.result_confirmed) continue;

    const isKnockout = isKnockoutStage(local.stage);
    const u = deriveFdUpdate(fx, { isKnockout, resolveTeam: resolveFdTeam });

    // Did the live score/status actually move since we last stored it? Only
    // not-yet-confirmed matches reach here (confirmed ones are skipped above),
    // so this is inherently scoped to the live matches — never the full schedule.
    if (
      u.homeGoals !== local.home_goals ||
      u.awayGoals !== local.away_goals ||
      u.status !== local.status
    ) {
      summary.scoreChanges++;
    }

    const patch: Record<string, unknown> = {
      external_ref: refId,
      status: u.status,
      minute: u.minute,
      home_goals: u.homeGoals,
      away_goals: u.awayGoals,
      last_synced_at: syncedAt,
    };
    if (isKnockout) {
      if (!local.home_code && u.homeCode) patch.home_code = u.homeCode;
      if (!local.away_code && u.awayCode) patch.away_code = u.awayCode;
    }
    if (u.resultConfirmed) {
      patch.result_confirmed = true;
      if (isKnockout && u.advancedCode) patch.advanced_code = u.advancedCode;
      summary.confirmed++;
    }

    patches.push({ id: local.id, patch });
  }

  const results = await Promise.all(
    patches.map((p) => db.from("matches").update(p.patch).eq("id", p.id)),
  );
  summary.updated = results.filter((r) => !r.error).length;

  // Any score move (live or confirmed) can shift the standings now that live
  // scores count provisionally, so warm every group's stored share image when
  // something actually changed — and only then, so quiet polls cost nothing.
  // Best-effort and dynamically imported so the (next/og) renderer never weighs
  // on the poll's hot path or fails it; unchanged boards short-circuit on the
  // content hash without re-rendering.
  if (summary.confirmed > 0 || summary.scoreChanges > 0) {
    try {
      const { regenerateAllGroupOgImages } = await import("./og-images");
      await regenerateAllGroupOgImages();
    } catch {
      // leave the previous images in place; the endpoint still serves them
    }
  }
  return summary;
}

export interface PollResult {
  synced: boolean;
  reason?: string;
  summary?: SyncSummary;
}

/**
 * Minimum seconds between live-window polls. football-data.org's free tier
 * limits us to 10 requests/minute with no daily cap, and one poll is one
 * request, so ~once a minute is comfortable (1/10th of the limit). This floor
 * just de-dupes back-to-back triggers; it isn't a budget constraint.
 */
const MIN_POLL_INTERVAL_SEC = 30;

/**
 * Coarse cadence for reconciling stragglers — matches that kicked off and are
 * still unconfirmed but whose live window passed long ago (e.g. a FINISHED the
 * feed never delivered, or a cron gap that outlasted the live window). One feed
 * request returns the whole schedule, so a straggler costs nothing extra to fold
 * into a live poll; this floor only governs the case where a straggler is the
 * *only* reason to poll, so a match the feed never finishes can't burn requests
 * every minute forever while it still self-heals within a few minutes.
 */
const STRAGGLER_POLL_INTERVAL_SEC = 5 * 60;

/**
 * Poll guard, meant to be called frequently (e.g. a once-a-minute cron). It
 * calls football-data when a match is in (or near) its expected window, AND
 * keeps polling for ANY kicked-off match we haven't confirmed yet — the feed's
 * FINISHED can lag (or be missed entirely if the cron has a gap), and we must
 * keep checking until it lands so a finished game never stays stuck on "live".
 * Live/just-finished matches poll at MIN_POLL_INTERVAL_SEC; older unconfirmed
 * stragglers reconcile at the coarser STRAGGLER_POLL_INTERVAL_SEC. Considering
 * all matches (not just today's, UTC) keeps games that span midnight — and ones
 * stranded by an earlier outage — updating until they're resolved.
 */
export async function pollIfDue(now: Date = new Date()): Promise<PollResult> {
  const db = createAdminClient();
  const nowMs = now.getTime();
  // Matches kicked off within this window (longer than the longest possible
  // knockout + extra time + penalties) are the live / just-finished ones that
  // drive the fast cadence; older unconfirmed ones are reconciled more coarsely.
  const recentFloorMs = nowMs - 4 * 60 * 60 * 1000;

  const { data } = await db
    .from("matches")
    .select("kickoff_at, stage, last_synced_at, status, result_confirmed, is_trial");
  const rows = data ?? [];
  // Recent or imminent matches — the ones that can be inside a live window now.
  const recent = rows.filter((r) => {
    const ko = Date.parse(r.kickoff_at);
    return ko >= recentFloorMs && ko <= nowMs + 10 * 60_000;
  });

  const windows = mergeWindows(
    recent.map((r) => expectedMatchWindow({ kickoffAt: r.kickoff_at, stage: r.stage })),
  );
  const inWindow = windows.some((w) => nowMs >= w.startMs && nowMs < w.endMs);

  // Kicked off and still unconfirmed: keep polling until the feed reports the
  // finish (which auto-confirms). Checked across ALL matches, not just recent
  // ones — a single missed FINISHED (e.g. a cron gap outlasting the live window)
  // would otherwise strand a game on "live" forever, hiding it from past results.
  // Trial/demo matches are never fed, so they're excluded.
  const unfinished = (r: (typeof rows)[number]): boolean => {
    const ko = Date.parse(r.kickoff_at);
    return (
      ko <= nowMs &&
      !r.result_confirmed &&
      r.status !== "cancelled" &&
      r.status !== "postponed" &&
      !r.is_trial
    );
  };
  const awaitingFinish = recent.some(unfinished);
  const anyUnfinished = rows.some(unfinished);

  if (!inWindow && !anyUnfinished) {
    return { synced: false, reason: "no live window" };
  }

  // Fast cadence while a match is live or just finished; a coarse one when the
  // only thing left to do is reconcile an older straggler.
  const fast = inWindow || awaitingFinish;
  const minIntervalSec = fast ? MIN_POLL_INTERVAL_SEC : STRAGGLER_POLL_INTERVAL_SEC;
  const lastSynced = rows.reduce((max, r) => {
    const t = r.last_synced_at ? Date.parse(r.last_synced_at) : 0;
    return t > max ? t : max;
  }, 0);
  if (lastSynced && nowMs - lastSynced < minIntervalSec * 1000) {
    return { synced: false, reason: "paced" };
  }

  const summary = await syncDay();
  return { synced: true, summary };
}
