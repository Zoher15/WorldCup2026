"use client";

import { useState } from "react";
import { BreakdownRow } from "./BreakdownRow";
import { CountUp } from "./CountUp";
import { MatchCard, toMatchCardData } from "./MatchCard";
import { PlayerLink } from "./PlayerLink";
import { FOCUS_RING, LIVE_TEXT, PREDICTION_TEXT, RESULT_TEXT } from "./theme";
import { useLiveRefresh } from "./useLiveRefresh";
import type { MatchBoard, MatchBoardRow } from "@/lib/match-leaderboard";

/** The right-hand status for a revealed row: the player's call + points, with
 *  the same tap-for-math expansion the match card uses. */
function RevealedScore({ row }: { row: MatchBoardRow }) {
  const [open, setOpen] = useState(false);

  if (!row.hasPrediction) {
    return <span className="text-xs font-bold text-stone-400">No pick</span>;
  }
  const pick = row.pick!;
  const call = (
    <span className={`font-black ${PREDICTION_TEXT} tabular-nums`}>
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
        className={`inline-flex items-center gap-2 rounded-full glass px-2.5 py-1 transition active:scale-95 ${FOCUS_RING}`}
      >
        {call}
        <span
          className={`font-black tabular-nums ${
            row.provisional ? LIVE_TEXT : RESULT_TEXT
          }`}
        >
          {row.provisional ? "~" : ""}
          <CountUp value={row.points} /> pt{row.points === 1 ? "" : "s"}
        </span>
        <span className="text-[10px] font-bold text-stone-400">
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
              className={`text-sm font-black tabular-nums ${
                row.provisional ? LIVE_TEXT : RESULT_TEXT
              }`}
            >
              <CountUp value={b.total} /> pt{b.total === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** A player's name, linked to their in-group profile (except the bot). */
function PlayerName({ row, code }: { row: MatchBoardRow; code: string }) {
  return (
    <PlayerLink
      userId={row.userId}
      code={row.isBot ? undefined : code}
      title={row.displayName}
      className={row.isBot ? undefined : "truncate"}
    >
      <span className="truncate font-bold text-stone-800 dark:text-stone-100">
        {row.displayName}
        {row.isViewer && (
          <span className="ml-1.5 text-[10px] font-bold text-stone-400">(you)</span>
        )}
      </span>
    </PlayerLink>
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
      <MatchCard data={toMatchCardData(board.match)} pick={null} />

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
                className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 transition hover:scale-[1.01] ${
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
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <PlayerName row={r} code={group.code} />
                  {/* Called it right while most of the group got it wrong. */}
                  {r.upset && (
                    <span
                      className="shrink-0 rounded-full glass px-2 py-0.5 text-[10px] font-bold text-sunburst"
                      title="Called it against the group's consensus"
                    >
                      🔮 Against the crowd
                    </span>
                  )}
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
