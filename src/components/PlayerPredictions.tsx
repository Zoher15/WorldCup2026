"use client";

import Link from "next/link";
import { Flag } from "./Flag";
import { teamLabel } from "@/lib/fifa";
import { formatKickoffDateTime, formatStageLabel } from "@/lib/format";
import type { PlayerPredictionRow, PlayerProfile } from "@/lib/player";

const score = (a: number, b: number) => `${a}–${b}`;

function Teams({ row }: { row: PlayerPredictionRow }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Flag code={row.homeCode} size="sm" />
        <span className="truncate">{teamLabel(row.homeCode, row.homeLabel)}</span>
      </div>
      <span className="text-stone-300">v</span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="truncate text-right">
          {teamLabel(row.awayCode, row.awayLabel)}
        </span>
        <Flag code={row.awayCode} size="sm" />
      </div>
    </div>
  );
}

function Meta({ row }: { row: PlayerPredictionRow }) {
  return (
    <div className="mb-1 flex items-center justify-between text-xs font-bold text-stone-400">
      <span>
        #{row.matchNumber} · {formatStageLabel(row.groupLabel, row.stage)}
      </span>
      <span>{formatKickoffDateTime(row.kickoffAt)}</span>
    </div>
  );
}

/** A past (kicked-off) match: pick and result are revealed for everyone. */
function PastRow({ row }: { row: PlayerPredictionRow }) {
  return (
    <div className="rounded-2xl bg-white/85 p-3 shadow ring-1 ring-black/5">
      <Meta row={row} />
      <Teams row={row} />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold">
        <span className="text-stone-500">
          Pick:{" "}
          {row.pick ? (
            <span className="text-grape">{score(row.pick.home, row.pick.away)}</span>
          ) : (
            <span className="text-stone-400">no prediction</span>
          )}
        </span>
        {row.result && (
          <span className="text-stone-500">
            Result:{" "}
            <span className="text-ocean">
              {score(row.result.home, row.result.away)}
            </span>
          </span>
        )}
        {row.points != null ? (
          <span className="ml-auto rounded-full bg-pitch/15 px-2.5 py-1 font-black text-pitch">
            +{row.points} pts
          </span>
        ) : row.result == null ? (
          <span className="ml-auto text-stone-400">awaiting result</span>
        ) : row.hasPrediction ? (
          <span className="ml-auto text-stone-400">before you joined</span>
        ) : null}
      </div>
    </div>
  );
}

/** An open/upcoming match: pick stays hidden, only entered-or-not is shown. */
function FutureRow({ row }: { row: PlayerPredictionRow }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3 shadow ring-1 ring-black/5">
      <Meta row={row} />
      <Teams row={row} />
      <div className="mt-2 text-xs font-bold">
        {row.pick ? (
          // Owner viewing their own pick.
          <span className="text-grape">Your pick: {score(row.pick.home, row.pick.away)}</span>
        ) : row.hasPrediction ? (
          <span className="text-stone-500">🔒 Entered · hidden until kickoff</span>
        ) : (
          <span className="text-stone-400">Not entered yet</span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  rows,
  empty,
  render,
}: {
  title: string;
  rows: PlayerPredictionRow[];
  empty: string;
  render: (row: PlayerPredictionRow) => React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-stone-400">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-medium text-stone-400">
          {empty}
        </p>
      ) : (
        <div className="space-y-2">{rows.map(render)}</div>
      )}
    </section>
  );
}

export function PlayerPredictions({ profile }: { profile: PlayerProfile }) {
  const open = profile.rows.filter((r) => r.state === "open");
  const upcoming = profile.rows.filter((r) => r.state === "upcoming");
  // Most-recent first for finished/in-progress matches.
  const past = profile.rows
    .filter((r) => r.state === "locked")
    .reverse();

  return (
    <div>
      <Section
        title="Open now"
        rows={open}
        empty="No matches are open for prediction right now."
        render={(r) => <FutureRow key={r.matchId} row={r} />}
      />
      <Section
        title="Upcoming"
        rows={upcoming}
        empty="Nothing on the horizon yet."
        render={(r) => <FutureRow key={r.matchId} row={r} />}
      />
      <Section
        title="Past"
        rows={past}
        empty="No matches have kicked off yet."
        render={(r) => <PastRow key={r.matchId} row={r} />}
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
