"use client";

import Link from "next/link";
import { MatchCard, type MatchCardData, type MatchCardState } from "./MatchCard";
import type { PlayerPredictionRow, PlayerProfile } from "@/lib/player";

/** A single match in a player's profile, rendered as the shared scoreboard. */
function PlayerCard({ row, isBot }: { row: PlayerPredictionRow; isBot: boolean }) {
  // A kicked-off match with a confirmed result reads as "final"; otherwise it
  // keeps its prediction-window state (upcoming / open / locked-awaiting).
  const state: MatchCardState =
    row.state === "locked" && row.result ? "final" : row.state;

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
    homeGoals: row.result?.home,
    awayGoals: row.result?.away,
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
      pick={row.pick ? { home: row.pick.home, away: row.pick.away } : null}
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

export function PlayerPredictions({ profile }: { profile: PlayerProfile }) {
  const { isBot } = profile.player;
  const open = profile.rows.filter((r) => r.state === "open");
  const upcoming = profile.rows.filter((r) => r.state === "upcoming");
  // Most-recent first for finished/in-progress matches.
  const past = profile.rows.filter((r) => r.state === "locked").reverse();

  return (
    <div>
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
      <Section
        title="Past"
        rows={past}
        empty="No matches have kicked off yet."
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
