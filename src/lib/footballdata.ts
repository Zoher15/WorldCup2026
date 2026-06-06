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
