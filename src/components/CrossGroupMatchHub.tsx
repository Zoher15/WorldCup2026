"use client";

import Link from "next/link";
import { MatchCard, toMatchCardData } from "./MatchCard";
import { MatchBoardRows } from "./MatchLeaderboard";
import { useLiveRefresh } from "./useLiveRefresh";
import type { MatchBoard, MatchBoardMatch } from "@/lib/match-leaderboard";

/**
 * The cross-group match hub: one shared scoreboard card up top, then a
 * collapsible section per group the viewer belongs to, each revealing that
 * group's per-match leaderboard. Lets you compare how all your groups called the
 * same game without hopping between group pages.
 */
export function CrossGroupMatchHub({
  match,
  boards,
}: {
  match: MatchBoardMatch;
  boards: MatchBoard[];
}) {
  // One refresh ticker for the whole page while the match is in play.
  useLiveRefresh(boards.some((b) => b.match.live != null));

  return (
    <div>
      <MatchCard data={toMatchCardData(match)} pick={null} />

      <div className="mt-6 space-y-3">
        {boards.map((board, i) => (
          <details
            key={board.group.code}
            open={i === 0}
            className="rounded-3xl glass p-2.5 sm:p-3 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <Link
                href={`/g/${board.group.code}`}
                prefetch={false}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 truncate text-lg font-black text-violet-300 hover:underline"
              >
                {board.group.name}
              </Link>
              <span className="shrink-0 text-xs font-medium text-stone-300">
                {board.summary.entered} of {board.summary.total}{" "}
                {board.revealed ? "predicted" : "entered"}
              </span>
              <span
                aria-hidden
                className="shrink-0 text-stone-400 transition-transform [details[open]_&]:rotate-180"
              >
                ▾
              </span>
            </summary>
            <div className="mt-3">
              <MatchBoardRows board={board} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
