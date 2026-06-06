import { createAdminClient } from "./supabase/admin";
import { fetchWorldCupMatches } from "./footballdata";
import { resolveFdTeam } from "./fifa";
import { expectedMatchWindow, mergeWindows } from "./polling";
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
    .select("id, external_ref, kickoff_at, stage, home_code, away_code, result_confirmed");
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

    const isKnockout = local.stage !== "group";
    const u = deriveFdUpdate(fx, { isKnockout, resolveTeam: resolveFdTeam });

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
 * Poll guard, meant to be called frequently (e.g. a once-a-minute cron). It
 * only calls football-data when a match is actually live — using each match's
 * expected window, which covers stoppage/extra time/penalties — and de-dupes
 * polls closer than MIN_POLL_INTERVAL_SEC. Outside live windows it returns
 * immediately without touching the API.
 */
export async function pollIfDue(now: Date = new Date()): Promise<PollResult> {
  const db = createAdminClient();
  const dateKey = now.toISOString().slice(0, 10);
  const nowMs = now.getTime();

  const { data } = await db
    .from("matches")
    .select("kickoff_at, stage, last_synced_at");
  const rows = data ?? [];
  const todays = rows.filter((r) => String(r.kickoff_at).slice(0, 10) === dateKey);

  const windows = mergeWindows(
    todays.map((r) => expectedMatchWindow({ kickoffAt: r.kickoff_at, stage: r.stage })),
  );
  const live = windows.some((w) => nowMs >= w.startMs && nowMs < w.endMs);
  if (!live) {
    return { synced: false, reason: "no live window" };
  }

  const lastSynced = todays.reduce((max, r) => {
    const t = r.last_synced_at ? Date.parse(r.last_synced_at) : 0;
    return t > max ? t : max;
  }, 0);
  if (lastSynced && nowMs - lastSynced < MIN_POLL_INTERVAL_SEC * 1000) {
    return { synced: false, reason: "paced" };
  }

  const summary = await syncDay(dateKey);
  return { synced: true, summary };
}
