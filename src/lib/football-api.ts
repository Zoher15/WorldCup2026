import type { MatchStatus } from "./types";

/**
 * Thin client for API-Football (api-sports.io v3). The key is server-only.
 * We scope every call to the World Cup (league 1, season 2026) and pull a whole
 * day at once, so a single request covers all of that day's matches.
 */
const API_BASE = "https://v3.football.api-sports.io";
const WORLD_CUP_LEAGUE = 1;
const SEASON = 2026;

export interface ApiFixture {
  fixture: {
    id: number;
    date: string; // ISO 8601
    status: { short: string; elapsed: number | null };
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    penalty: { home: number | null; away: number | null };
  };
}

function apiKey(): string {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) throw new Error("FOOTBALL_API_KEY is not configured.");
  return key;
}

/** Fetch all World Cup fixtures for a given UTC date (YYYY-MM-DD). */
export async function fetchFixturesByDate(date: string): Promise<ApiFixture[]> {
  const url =
    `${API_BASE}/fixtures?league=${WORLD_CUP_LEAGUE}` +
    `&season=${SEASON}&date=${date}&timezone=UTC`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { response?: ApiFixture[]; errors?: unknown };
  if (!Array.isArray(body.response)) {
    throw new Error(`Unexpected API response: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.response;
}

// --- pure status helpers (safe to unit-test) ---

const FINAL_STATUSES = new Set(["FT", "AET", "PEN"]);
const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
const CANCELLED_STATUSES = new Set(["CANC", "ABD", "WO", "AWD"]);

/** A finished, points-awarding status (full time / after ET / after penalties). */
export function isFinalStatus(short: string): boolean {
  return FINAL_STATUSES.has(short);
}

/** Map an API status code to our match status. */
export function statusToOurs(short: string): MatchStatus {
  if (FINAL_STATUSES.has(short)) return "finished";
  if (LIVE_STATUSES.has(short)) return "live";
  if (short === "PST" || short === "SUSP") return "postponed";
  if (CANCELLED_STATUSES.has(short)) return "cancelled";
  return "scheduled";
}
