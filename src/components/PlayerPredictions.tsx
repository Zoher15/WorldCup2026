"use client";

import Link from "next/link";
import { MatchCard, type MatchCardData, type MatchCardState } from "./MatchCard";
import { useLiveRefresh } from "./useLiveRefresh";
import type { PlayerPredictionRow, PlayerProfile } from "@/lib/player";

/** A live, kicked-off-and-unconfirmed match (vs an "awaiting result" one). */
function isLive(row: PlayerPredictionRow): boolean {
  return row.state === "locked" && row.live != null && row.result == null;
}

/** A single match in a player's profile, rendered as the shared scoreboard —
 *  identical whether it's the viewer's own card or another group member's. */
function PlayerCard({ row, isBot }: { row: PlayerPredictionRow; isBot: boolean }) {
  // Live (in-play) reads as "live"; a confirmed result as "final"; otherwise the
  // card keeps its prediction-window state (upcoming / open / locked-awaiting).
  let state: MatchCardState = row.state;
  if (row.state === "locked" && row.result) state = "final";
  else if (isLive(row)) state = "live";

  const data: MatchCardData = {
    homeCode: row.homeCode,
    awayCode: row.awayCode,
    homeLabel: row.homeLabel,
    awayLabel: row.awayLabel,
    kickoffAt: row.kickoffAt,
    stage: row.stage,
    groupLabel: row.groupLabel,
    venue: row.venue,
    state,
    minute: row.live?.minute,
    homeGoals: row.result?.home ?? row.live?.home,
    awayGoals: row.result?.away ?? row.live?.away,
    advancedCode: row.result?.advancedCode,
  };

  const status =
    row.state === "locked" ? (
      <PastStatus row={row} />
    ) : (
      <FutureStatus row={row} isBot={isBot} />
    );

  return (
    <MatchCard
      data={data}
      pick={
        row.pick
          ? {
              home: row.pick.home,
              away: row.pick.away,
              advancePick: row.pick.advancePick,
            }
          : null
      }
      status={status}
    />
  );
}

/**
 * Past (kicked-off) match: the pick is revealed, so the header chip shows their
 * call alongside the points earned (the focal tile carries the actual result).
 */
function PastStatus({ row }: { row: PlayerPredictionRow }) {
  if (row.pick && row.points != null) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-grape dark:text-violet-300">
          {row.pick.home}–{row.pick.away}
        </span>
        <span className="font-black text-pitch dark:text-emerald-400">+{row.points}</span>
      </span>
    );
  }
  if (!row.pick) return <span className="text-stone-400">No pick</span>;
  // Live: the pick is revealed (the match has kicked off); the running points
  // live in the tappable tile, so the chip just shows their call.
  if (isLive(row)) {
    return (
      <span className="text-grape dark:text-violet-300">
        {row.pick.home}–{row.pick.away}
      </span>
    );
  }
  if (row.result == null) return <span className="text-stone-400">Awaiting</span>;
  return <span className="text-stone-400">Pre-join</span>;
}

/** Open/upcoming match: the pick stays private — only entered-or-not is shown. */
function FutureStatus({ row, isBot }: { row: PlayerPredictionRow; isBot: boolean }) {
  if (isBot) return <span className="text-grape dark:text-violet-300">Predicts 0–0</span>;
  if (row.pick) return <span className="text-pitch dark:text-emerald-400">✓ Entered</span>;
  if (row.hasPrediction)
    return <span className="text-stone-500 dark:text-stone-300">🔒 Hidden</span>;
  return <span className="text-stone-400">Not entered</span>;
}

function Section({
  title,
  rows,
  empty,
  isBot,
}: {
  title: string;
  rows: PlayerPredictionRow[];
  empty: string;
  isBot: boolean;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-stone-400">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-2xl glass px-4 py-3 text-sm font-medium text-stone-400">
          {empty}
        </p>
      ) : (
        <div className="space-y-6">
          {rows.map((r) => (
            <PlayerCard key={r.matchId} row={r} isBot={isBot} />
          ))}
        </div>
      )}
    </section>
  );
}

export function PlayerPredictions({
  profile,
  view = "current",
}: {
  profile: PlayerProfile;
  /** "current" shows live/open/upcoming (plus the edit button on your own
   *  profile); "past" shows only finished matches — their own page, mirroring
   *  the predict → past-results split. */
  view?: "current" | "past";
}) {
  const { isBot } = profile.player;
  const live = profile.rows.filter(isLive);

  // Tick live scores forward while any match on this profile is in play (only
  // the current view carries live cards; the past page never does).
  useLiveRefresh(view === "current" && live.length > 0);

  if (view === "past") {
    // Finished / awaiting (locked but not currently live), most-recent first.
    const past = profile.rows
      .filter((r) => r.state === "locked" && !isLive(r))
      .reverse();
    if (past.length === 0) {
      return (
        <p className="rounded-2xl glass p-6 text-center font-medium text-stone-500 dark:text-stone-300">
          No finished matches yet — they&apos;ll appear here after kickoff.
        </p>
      );
    }
    return (
      <div className="space-y-6">
        {past.map((r) => (
          <PlayerCard key={r.matchId} row={r} isBot={isBot} />
        ))}
      </div>
    );
  }

  const open = profile.rows.filter((r) => r.state === "open");
  const upcoming = profile.rows.filter((r) => r.state === "upcoming");

  return (
    <div>
      {live.length > 0 && (
        <Section title="🔴 Live now" rows={live} empty="" isBot={isBot} />
      )}
      <Section
        title="Open now"
        rows={open}
        empty="No matches are open for prediction right now."
        isBot={isBot}
      />
      <Section
        title="Upcoming"
        rows={upcoming}
        empty="Nothing on the horizon yet."
        isBot={isBot}
      />

      {profile.player.isViewer && (
        <Link
          href="/predict"
          className="mt-2 inline-block rounded-full glass px-6 py-3 font-bold text-pitch dark:text-emerald-400 transition active:scale-95"
        >
          ⚽ Edit your predictions
        </Link>
      )}
    </div>
  );
}
