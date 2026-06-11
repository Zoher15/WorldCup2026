"use client";

import { useState } from "react";
import Link from "next/link";
import { MatchCard, type MatchCardData, type MatchCardState } from "./MatchCard";
import { useLiveRefresh } from "./useLiveRefresh";
import type { MatchBoard, MatchBoardRow } from "@/lib/match-leaderboard";

/** Build the shared scoreboard card for the match itself (no single pick). */
function cardData(match: MatchBoard["match"]): MatchCardData {
  let state: MatchCardState = match.state;
  if (match.state === "locked" && match.result) state = "final";
  else if (match.state === "locked" && match.live) state = "live";
  return {
    homeCode: match.homeCode,
    awayCode: match.awayCode,
    homeLabel: match.homeLabel,
    awayLabel: match.awayLabel,
    kickoffAt: match.kickoffAt,
    stage: match.stage,
    groupLabel: match.groupLabel,
    venue: match.venue,
    trial: match.trial,
    state,
    minute: match.live?.minute,
    homeGoals: match.result?.home ?? match.live?.home,
    awayGoals: match.result?.away ?? match.live?.away,
    advancedCode: match.result?.advancedCode,
  };
}

/** One line of the points math, mirroring the match card's breakdown rows. */
function BreakdownRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px] font-bold">
      <span className="text-stone-500 dark:text-stone-300">{label}</span>
      <span className="tabular-nums text-stone-700 dark:text-stone-100">
        +{value}
        {max != null && (
          <span className="text-stone-400 dark:text-stone-500"> / {max}</span>
        )}
      </span>
    </div>
  );
}

/** The right-hand status for a revealed row: the player's call + points, with
 *  the same tap-for-math expansion the match card uses. */
function RevealedScore({ row }: { row: MatchBoardRow }) {
  const [open, setOpen] = useState(false);

  if (!row.hasPrediction) {
    return <span className="text-xs font-bold text-stone-400">No pick</span>;
  }
  const pick = row.pick!;
  const call = (
    <span className="font-black text-grape dark:text-violet-300 tabular-nums">
      {pick.home}–{pick.away}
    </span>
  );

  // A revealed pick but outside the group's scoring window (start_even pre-join):
  // show the call, but it earns nothing here.
  if (!row.counts) {
    return (
      <span className="inline-flex items-center gap-2">
        {call}
        <span className="rounded-full glass px-2 py-0.5 text-[10px] font-bold text-stone-400">
          pre-join
        </span>
      </span>
    );
  }

  // Locked but not yet scorable (kicked off, no live/final score in hand).
  if (row.points == null || row.breakdown == null) {
    return (
      <span className="inline-flex items-center gap-2">
        {call}
        <span className="text-xs font-bold text-stone-400">awaiting</span>
      </span>
    );
  }

  const b = row.breakdown;
  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full glass px-2.5 py-1 transition active:scale-95"
      >
        {call}
        <span
          className={`font-black tabular-nums ${
            row.provisional
              ? "text-flame"
              : "text-pitch dark:text-emerald-400"
          }`}
        >
          {row.provisional ? "~" : ""}
          {row.points} pt{row.points === 1 ? "" : "s"}
        </span>
        <span className="text-[9px] font-bold text-stone-400">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="mt-1.5 w-44 rounded-xl glass px-3 py-2 text-left">
          <BreakdownRow label="Right result" value={b.outcome} max={5} />
          <BreakdownRow label="Scoreline closeness" value={b.closeness} max={5} />
          {b.knockout && <BreakdownRow label="Who advances" value={b.advance} />}
          <div className="mt-1 flex items-center justify-between border-t border-stone-300/60 pt-1 dark:border-stone-600/60">
            <span className="text-[11px] font-black uppercase tracking-wide text-stone-500 dark:text-stone-200">
              {row.provisional ? "If it ends now" : "Total"}
            </span>
            <span
              className={`text-sm font-black ${
                row.provisional
                  ? "text-flame"
                  : "text-pitch dark:text-emerald-400"
              }`}
            >
              {b.total} pt{b.total === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** A player's name, linked to their in-group profile (except the bot). */
function PlayerName({ row, code }: { row: MatchBoardRow; code: string }) {
  const name = (
    <span className="truncate font-bold text-stone-800 dark:text-stone-100">
      {row.displayName}
      {row.isViewer && (
        <span className="ml-1.5 text-[10px] font-bold text-stone-400">(you)</span>
      )}
    </span>
  );
  if (row.isBot) return name;
  return (
    <Link
      href={`/g/${code}/p/${row.userId}`}
      prefetch={false}
      className="truncate hover:underline"
    >
      {name}
    </Link>
  );
}

export function MatchLeaderboard({ board }: { board: MatchBoard }) {
  // Tick live points forward while the match is in play.
  useLiveRefresh(board.match.live != null);

  const { rows, revealed, summary, group } = board;

  // Standard competition ranking (1, 1, 3) over the scored rows; un-scored picks
  // get no medal number.
  let lastPoints: number | null = null;
  let lastRank = 0;

  return (
    <div>
      <MatchCard data={cardData(board.match)} pick={null} />

      <div className="mt-6 rounded-3xl glass p-5">
        <h2 className="mb-1 text-center text-xl font-black text-grape dark:text-violet-300">
          {revealed ? "🏅 This match" : "Who's locked in"}
        </h2>
        <p className="mb-4 text-center text-xs font-medium text-stone-500 dark:text-stone-300">
          {revealed
            ? `${summary.entered} of ${summary.total} predicted`
            : `${summary.entered} of ${summary.total} entered · picks reveal at kickoff`}
        </p>

        <ol className="space-y-2">
          {rows.map((r, i) => {
            let rank: number | null = null;
            if (revealed && r.points != null) {
              rank = r.points === lastPoints ? lastRank : i + 1;
              lastRank = rank;
              lastPoints = r.points;
            }
            return (
              <li
                key={r.userId}
                className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ${
                  r.isViewer
                    ? "glass ring-2 ring-grape/40 dark:ring-violet-300/40"
                    : "glass"
                }`}
              >
                {revealed && (
                  <span className="w-6 text-center font-black text-stone-400 tabular-nums">
                    {rank ?? "—"}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 items-center">
                  <PlayerName row={r} code={group.code} />
                </span>
                {revealed ? (
                  <RevealedScore row={r} />
                ) : r.hasPrediction ? (
                  <span className="text-xs font-bold text-pitch dark:text-emerald-400">
                    ✓ Entered
                  </span>
                ) : (
                  <span className="text-xs font-bold text-stone-400">
                    Not entered
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
