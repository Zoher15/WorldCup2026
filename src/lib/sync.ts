import { createAdminClient } from "./supabase/admin";
import { fetchFixturesByDate } from "./football-api";
import { resolveApiTeam } from "./fifa";
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
