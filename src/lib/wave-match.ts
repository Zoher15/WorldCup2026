/**
 * Resolves the single match that "owns" the brand wave right now: the live match
 * if one is in play, otherwise the next fixture to kick off. Its two teams colour
 * the wordmark, headings, card rim and live glow (see wave-colors.ts).
 *
 * Live state lives in the DB (written by the score sync), so a live read needs a
 * query; "next up" is pure static schedule. The whole thing fails open to null —
 * if the DB isn't configured or the query hiccups, the caller falls back to the
 * brand colours rather than blanking the wave or crashing the layout.
 */

import { createAdminClient } from "./supabase/admin";
import { FIXTURES } from "../data/fixtures";

export interface WaveMatch {
  homeCode: string | null;
  awayCode: string | null;
}

/**
 * How stale a `status='live'` row can be before the wave ignores it. Mirrors the
 * predict board's `liveFloorIso` (getPredictionBoard, predictions.ts): the board
 * keeps showing a match as live until its kickoff ages past this floor, so the
 * wave must use the SAME bound — otherwise the colours would move on to the next
 * match while the card still renders the old one live. We deliberately do NOT use
 * the tighter `liveWindowExpired` (expected-end) guard here: it fires before the
 * feed reports FINISHED, which is exactly what made the two disagree.
 */
const LIVE_STALE_FLOOR_MS = 4 * 60 * 60 * 1000;

/** The earliest fixture still ahead of `now` (static schedule, no DB). */
function nextUpcoming(now: number): WaveMatch | null {
  let best: { kickoffMs: number; match: WaveMatch } | null = null;
  for (const f of FIXTURES) {
    const ms = Date.parse(f.kickoffAt);
    if (Number.isNaN(ms) || ms <= now) continue;
    if (!best || ms < best.kickoffMs) {
      best = { kickoffMs: ms, match: { homeCode: f.homeCode, awayCode: f.awayCode } };
    }
  }
  return best?.match ?? null;
}

/**
 * The match driving the wave: the live match (earliest kickoff if several feeds
 * report live at once, ignoring any stale beyond the board's live floor so an
 * ancient stuck-"live" row can't hijack the colours), else the next fixture up.
 * Null only when nothing is live and the schedule is exhausted.
 */
export async function getWaveMatch(now: Date = new Date()): Promise<WaveMatch | null> {
  const nowMs = now.getTime();
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("matches")
      .select("home_code, away_code, kickoff_at")
      .eq("status", "live")
      .order("kickoff_at", { ascending: true });
    const live = (data ?? []).find(
      (m: { kickoff_at: string }) =>
        Date.parse(m.kickoff_at) >= nowMs - LIVE_STALE_FLOOR_MS,
    );
    if (live) return { homeCode: live.home_code, awayCode: live.away_code };
  } catch {
    // DB not configured or a transient read error — fall through to the
    // schedule so the wave still picks up the next match.
  }
  return nextUpcoming(nowMs);
}
