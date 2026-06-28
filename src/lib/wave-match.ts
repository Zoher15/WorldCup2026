/**
 * Resolves the single match that "owns" the brand wave right now: the live match
 * if one is in play, otherwise the next fixture to kick off. Its two teams colour
 * the wordmark, headings, card rim and live glow (see wave-colors.ts).
 *
 * Both the live match and the next-up fixture are read from the DB (written by
 * the score sync / bracket resolution) so the wave reflects the real teams —
 * crucial for knockouts, whose static fixtures carry null codes until the
 * bracket resolves. The whole thing fails open: if the DB isn't configured or a
 * query hiccups it falls back to the static schedule (then to the brand colours)
 * rather than blanking the wave or crashing the layout.
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

    // Next up: read the resolved teams from the DB, not the static schedule.
    // Knockout fixtures ship with null codes (placeholders like "Runner-up
    // Group A") until the bracket resolves — only the DB carries the real teams
    // once they're set. Reading FIXTURES here would paint the wave with the
    // brand fallback instead of the upcoming matchup's flags. Trial rows are
    // excluded so the how-to-play demo can't hijack the colours.
    const { data: upcoming } = await db
      .from("matches")
      .select("home_code, away_code, kickoff_at")
      .eq("is_trial", false)
      .gt("kickoff_at", now.toISOString())
      .order("kickoff_at", { ascending: true })
      .limit(1);
    const next = upcoming?.[0];
    if (next) return { homeCode: next.home_code, awayCode: next.away_code };
  } catch {
    // DB not configured or a transient read error — fall through to the static
    // schedule so the wave still picks up the next match (group-stage codes are
    // already baked into FIXTURES).
  }
  return nextUpcoming(nowMs);
}
