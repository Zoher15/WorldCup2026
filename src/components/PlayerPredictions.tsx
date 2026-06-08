"use client";

import Link from "next/link";
import { MatchCard, type MatchCardData, type MatchCardState } from "./MatchCard";
import type { PlayerPredictionRow, PlayerProfile } from "@/lib/player";

/** A single match in a player's profile, rendered as the shared scoreboard. */
function PlayerCard({ row }: { row: PlayerPredictionRow }) {
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

  const footer =
    row.state === "locked" ? <PastFooter row={row} /> : <FutureFooter row={row} />;

  return (
    <MatchCard
      data={data}
      pick={row.pick ? { home: row.pick.home, away: row.pick.away } : null}
      footer={footer}
    />
  );
}

/** Past (kicked-off) match: the pick and points earned are revealed to everyone. */
function PastFooter({ row }: { row: PlayerPredictionRow }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-stone-500 dark:text-stone-300">
        {row.pick ? (
          <>
            Pick{" "}
            <span className="text-grape">
              {row.pick.home}–{row.pick.away}
            </span>
          </>
        ) : (
          <span className="text-stone-400">No prediction</span>
        )}
      </span>
      {row.points != null ? (
        <span className="rounded-full bg-pitch/15 px-2.5 py-0.5 font-black text-pitch">
          +{row.points} pts
        </span>
      ) : row.result == null ? (
        <span className="text-stone-400">awaiting result</span>
      ) : row.hasPrediction ? (
        <span className="text-stone-400">before you joined</span>
      ) : null}
    </div>
  );
}

/** Open/upcoming match: the pick stays private — only entered-or-not is shown. */
function FutureFooter({ row }: { row: PlayerPredictionRow }) {
  if (row.pick) return <span className="text-pitch">✓ You&apos;re in</span>;
  if (row.hasPrediction)
    return (
      <span className="text-stone-500 dark:text-stone-300">🔒 Entered · hidden until kickoff</span>
    );
  return <span className="text-stone-400">Not entered yet</span>;
}

function Section({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: PlayerPredictionRow[];
  empty: string;
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
        <div className="space-y-5">
          {rows.map((r) => (
            <PlayerCard key={r.matchId} row={r} />
          ))}
        </div>
      )}
    </section>
  );
}

export function PlayerPredictions({ profile }: { profile: PlayerProfile }) {
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
      />
      <Section
        title="Upcoming"
        rows={upcoming}
        empty="Nothing on the horizon yet."
      />
      <Section
        title="Past"
        rows={past}
        empty="No matches have kicked off yet."
      />

      {profile.player.isViewer && (
        <Link
          href="/predict"
          className="mt-2 inline-block rounded-full bg-pitch px-6 py-3 font-bold text-white shadow transition active:scale-95"
        >
          ⚽ Edit your predictions
        </Link>
      )}
    </div>
  );
}
