import { createAdminClient } from "./supabase/admin";
import { fetchFixturesByDate } from "./football-api";
import { resolveApiTeam } from "./fifa";
import { planDay, isWithinLiveWindows } from "./polling";
import {
  deriveMatchUpdate,
  matchApiFixtureToLocal,
  type LocalMatchRef,
} from "./sync-core";

export interface SyncSummary {
  fetched: number;
  updated: number;
  confirmed: number;
  unmatched: number;
}

/**
 * Sync all World Cup fixtures for a UTC date from API-Football into our matches.
 *
 *  - Links each fixture to a local match by stored external_ref, else by
 *    time/teams, recording the link for next time.
 *  - Writes live status/minute/score; fills in knockout teams once known.
 *  - Auto-confirms results on FT/AET/PEN (the points gate).
 *  - Never overwrites a match that's already confirmed, so manual admin
 *    corrections always win.
 */
export async function syncDay(date: string): Promise<SyncSummary> {
  const db = createAdminClient();
  const fixtures = await fetchFixturesByDate(date);

  // Load local matches near this date (±1 day) plus any already linked.
  const { data: localRows } = await db
    .from("matches")
    .select("id, external_ref, kickoff_at, stage, home_code, away_code, result_confirmed");
  const locals = localRows ?? [];
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

  for (const fx of fixtures) {
    const refId = String(fx.fixture.id);
    let local = byRef.get(refId) ?? null;
    if (!local) {
      const matchedId = matchApiFixtureToLocal(fx, refs, resolveApiTeam);
      local = matchedId ? locals.find((l) => l.id === matchedId) ?? null : null;
    }
    if (!local) {
      summary.unmatched++;
      continue;
    }
    // Respect manual/earlier confirmations — never clobber a final result.
    if (local.result_confirmed) continue;

    const isKnockout = local.stage !== "group";
    const u = deriveMatchUpdate(fx, { isKnockout, resolveCode: resolveApiTeam });

    const patch: Record<string, unknown> = {
      external_ref: refId,
      status: u.status,
      minute: u.minute,
      home_goals: u.homeGoals,
      away_goals: u.awayGoals,
      last_synced_at: new Date().toISOString(),
    };
    // Fill in knockout teams once the API knows them.
    if (isKnockout) {
      if (!local.home_code && u.homeCode) patch.home_code = u.homeCode;
      if (!local.away_code && u.awayCode) patch.away_code = u.awayCode;
    }
    if (u.resultConfirmed) {
      patch.result_confirmed = true;
      if (isKnockout && u.advancedCode) patch.advanced_code = u.advancedCode;
      summary.confirmed++;
    }

    const { error } = await db.from("matches").update(patch).eq("id", local.id);
    if (!error) summary.updated++;
  }

  return summary;
}

export interface PollResult {
  synced: boolean;
  reason?: string;
  summary?: SyncSummary;
}

/**
 * Budget-aware poll, meant to be called frequently (e.g. a once-a-minute cron).
 * It only spends an API request when there's actually a match live AND enough
 * time has passed since the last sync (the interval the planner computed for
 * the day). Outside live windows it returns immediately without touching the
 * API, so frequent cron ticks stay well within the free quota.
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

  const plan = planDay(
    dateKey,
    todays.map((r) => ({ kickoffAt: r.kickoff_at, stage: r.stage })),
  );

  if (!isWithinLiveWindows(nowMs, plan)) {
    return { synced: false, reason: "no live window" };
  }

  const lastSynced = todays.reduce((max, r) => {
    const t = r.last_synced_at ? Date.parse(r.last_synced_at) : 0;
    return t > max ? t : max;
  }, 0);
  if (lastSynced && nowMs - lastSynced < plan.intervalSec * 1000) {
    return { synced: false, reason: "paced" };
  }

  const summary = await syncDay(dateKey);
  return { synced: true, summary };
}
