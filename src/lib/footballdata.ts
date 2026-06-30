/**
 * Diagnostics probe for football-data.org (the last free candidate). It's
 * reputable and its free tier covers the World Cup competition (code "WC"),
 * returning final scores (delayed, not live in-play). This checks whether the
 * free token actually returns 2026 matches with scores, and captures the schema.
 *
 * Auth: token in the `X-Auth-Token` header. Free tier ~10 requests/min.
 */
const FD_BASE = "https://api.football-data.org/v4";

function fdToken(): string {
  const t = process.env.FOOTBALL_DATA_TOKEN;
  if (!t) throw new Error("FOOTBALL_DATA_TOKEN is not configured.");
  return t;
}

async function fdGet(path: string): Promise<{ status: number; ok: boolean; json: unknown; text: string }> {
  const res = await fetch(`${FD_BASE}${path}`, {
    headers: { "X-Auth-Token": fdToken() },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return { status: res.status, ok: res.ok, json, text };
}

export interface FdTeam {
  id: number;
  name: string;
  tla: string | null;
}

/**
 * A two-sided score block from football-data. v4 keys the sides `home`/`away`;
 * some payloads (and older docs) use `homeTeam`/`awayTeam`, so downstream code
 * tolerates either rather than silently reading `undefined` from the wrong key.
 */
export interface FdSideScore {
  home?: number | null;
  away?: number | null;
  homeTeam?: number | null;
  awayTeam?: number | null;
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string; // TIMED | SCHEDULED | IN_PLAY | PAUSED | FINISHED | AWARDED | POSTPONED | SUSPENDED | CANCELLED
  stage: string; // GROUP_STAGE | LAST_16 | ... | FINAL
  group: string | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    winner: string | null; // HOME_TEAM | AWAY_TEAM | DRAW
    duration: string; // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
    // The FINAL score and, for a tie settled on penalties, this INCLUDES the
    // shootout goals (e.g. a 1-1 won 6-5 on penalties is reported here as 7-6).
    // We grade closeness on the end-of-extra-time scoreline, so fd-core peels the
    // shootout back off (see endOfPlayScoreline).
    fullTime: FdSideScore;
    halfTime?: FdSideScore | null;
    // The clean components: goals after 90 minutes, goals scored within extra
    // time, and the shootout tally. Present for extra-time / shootout matches,
    // and used to reconstruct the on-pitch scoreline without the shootout.
    regularTime?: FdSideScore | null;
    extraTime?: FdSideScore | null;
    penalties?: FdSideScore | null;
  };
}

/** Fetch World Cup matches (all of the current season, or a date range). */
export async function fetchWorldCupMatches(
  dateFrom?: string,
  dateTo?: string,
): Promise<FdMatch[]> {
  let path = "/competitions/WC/matches";
  if (dateFrom && dateTo) path += `?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const r = await fdGet(path);
  if (!r.ok) {
    throw new Error(`football-data ${r.status}: ${r.text.slice(0, 200)}`);
  }
  return ((r.json as { matches?: FdMatch[] })?.matches ?? []);
}

export async function footballDataDiagnostics(): Promise<unknown> {
  const out: Record<string, unknown> = {};

  // 1. Competition meta — name, current season, how many seasons are exposed.
  try {
    const r = await fdGet("/competitions/WC");
    const j = r.json as Record<string, unknown> | null;
    out.competition = r.ok
      ? {
          status: r.status,
          name: j?.name,
          code: j?.code,
          currentSeason: j?.currentSeason,
          numberOfSeasons: Array.isArray(j?.seasons) ? j!.seasons.length : undefined,
        }
      : { status: r.status, body: r.text.slice(0, 300) };
  } catch (e) {
    out.competition = { error: e instanceof Error ? e.message : "failed" };
  }

  // 2. Matches on opening day 2026 — does free return them, with a score field?
  try {
    const r = await fdGet("/competitions/WC/matches?dateFrom=2026-06-11&dateTo=2026-06-12");
    const j = r.json as Record<string, unknown> | null;
    const matches = (j?.matches as unknown[]) ?? [];
    out.matches = r.ok
      ? {
          status: r.status,
          count: (j?.resultSet as { count?: number })?.count ?? matches.length,
          sample: matches[0] ?? null,
        }
      : { status: r.status, body: r.text.slice(0, 400) };
  } catch (e) {
    out.matches = { error: e instanceof Error ? e.message : "failed" };
  }

  return out;
}
