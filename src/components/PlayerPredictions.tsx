"use client";

import Link from "next/link";
import { MatchCard, toMatchCardData } from "./MatchCard";
import { PREDICTION_TEXT, RESULT_TEXT } from "./theme";
import { useLiveRefresh } from "./useLiveRefresh";
import { isFinal, isInPlay, isLive } from "@/lib/match-predicates";
import type { PlayerPredictionRow, PlayerProfile } from "@/lib/player";

/** A single match in a player's profile, rendered as the shared scoreboard —
 *  identical whether it's the viewer's own card or another group member's. */
function PlayerCard({ row, isBot }: { row: PlayerPredictionRow; isBot: boolean }) {
  // Live (in-play) reads as "live"; a confirmed result as "final"; otherwise the
  // card keeps its prediction-window state (upcoming / open / locked-awaiting).
  const data = toMatchCardData(row);

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
        <span className={PREDICTION_TEXT}>
          {row.pick.home}–{row.pick.away}
        </span>
        <span className={`font-black ${RESULT_TEXT}`}>+{row.points}</span>
      </span>
    );
  }
  if (!row.pick) return <span className="text-stone-400">No pick</span>;
  // Live: the pick is revealed (the match has kicked off); the running points
  // live in the tappable tile, so the chip just shows their call.
  if (isLive(row)) {
    return (
      <span className={PREDICTION_TEXT}>
        {row.pick.home}–{row.pick.away}
      </span>
    );
  }
  if (row.result == null) return <span className="text-stone-400">Awaiting</span>;
  return <span className="text-stone-400">Pre-join</span>;
}

/** Open/upcoming match: the pick stays private — only entered-or-not is shown. */
function FutureStatus({ row, isBot }: { row: PlayerPredictionRow; isBot: boolean }) {
  if (isBot) return <span className={PREDICTION_TEXT}>Predicts 0–0</span>;
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
        <div className="grid gap-6 sm:grid-cols-2">
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
  const inPlay = profile.rows.filter(isInPlay);

  // Tick scores forward while any match on this profile is in play (only the
  // current view carries in-play cards; the past page never does).
  useLiveRefresh(view === "current" && inPlay.length > 0);

  if (view === "past") {
    // Only finalized (confirmed-result) matches, most-recent first. In-play and
    // awaiting-confirmation matches stay in the current view.
    const past = profile.rows.filter(isFinal).reverse();
    if (past.length === 0) {
      return (
        <div className="rounded-2xl glass p-6 text-center font-medium text-stone-500 dark:text-stone-300">
          <div className="mb-2 text-4xl">⚽</div>
          No finished matches yet — they&apos;ll appear here after kickoff.
        </div>
      );
    }
    return (
      <div className="grid gap-6 sm:grid-cols-2">
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
      {inPlay.length > 0 && (
        <Section title="🔴 Live now" rows={inPlay} empty="" isBot={isBot} />
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
