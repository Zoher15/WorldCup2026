"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { LiveBadge, FullTimeBadge } from "./StatusBadge";
import { FOCUS_RING } from "./theme";
import { teamLabel } from "@/lib/fifa";
import {
  formatStageLabel,
  formatKickoffDateTime,
} from "@/lib/format";
import type { BoardMatchSummary } from "@/lib/match-leaderboard";

/** The right-hand status for a match row: live score, full-time result, or the
 *  kickoff time — a compact mirror of the match card's status pill. */
function MatchStatus({ match }: { match: BoardMatchSummary }) {
  const hasScore = match.homeGoals != null && match.awayGoals != null;

  if (match.isLive && hasScore) {
    return (
      <LiveBadge>
        <span className="font-black tabular-nums">
          {match.homeGoals}–{match.awayGoals}
        </span>
      </LiveBadge>
    );
  }
  if (match.state === "locked") {
    if (match.isFinished && hasScore) {
      return (
        <FullTimeBadge className="font-black tabular-nums">
          {match.homeGoals}–{match.awayGoals}
          <span className="ml-1 text-[10px] font-bold text-stone-400">FT</span>
        </FullTimeBadge>
      );
    }
    return <span className="text-xs font-bold text-stone-400">In play</span>;
  }
  if (match.state === "open") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-flame">
        <Icon name="clock" /> Open
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-stone-400">
      {formatKickoffDateTime(match.kickoffAt)}
    </span>
  );
}

/** One match row, linking to its per-match leaderboard. */
function MatchRow({ code, match }: { code: string; match: BoardMatchSummary }) {
  const home = teamLabel(match.homeCode, match.homeLabel);
  const away = teamLabel(match.awayCode, match.awayLabel);
  const stageLabel = formatStageLabel(match.groupLabel, match.stage);
  return (
    <li>
      <Link
        href={`/g/${code}/m/${match.id}`}
        prefetch={false}
        className={`flex items-center gap-3 rounded-2xl glass px-4 py-2.5 transition hover:scale-[1.01] active:scale-[0.99] ${FOCUS_RING}`}
      >
        <span
          title={stageLabel}
          className="hidden w-24 shrink-0 truncate text-[11px] font-bold uppercase tracking-wide text-stone-400 sm:block"
        >
          {stageLabel}
        </span>
        <span
          title={`${home} v ${away}`}
          className="min-w-0 flex-1 truncate font-bold text-stone-100"
        >
          {home}
          <span className="px-1.5 text-stone-400">v</span>
          {away}
        </span>
        <MatchStatus match={match} />
        <span className="text-violet-300">→</span>
      </Link>
    </li>
  );
}

/** A group's matches as entry points to each one's per-match leaderboard. Live
 *  and upcoming show by default; finished matches tuck into an expander so a
 *  full-time game moves out of the active list but stays one tap away. */
export function GroupMatches({
  code,
  matches,
}: {
  code: string;
  matches: BoardMatchSummary[];
}) {
  const [showFinished, setShowFinished] = useState(false);
  if (matches.length === 0) return null;

  const current = matches.filter((m) => !m.isFinished);
  const finished = matches.filter((m) => m.isFinished);

  return (
    <section className="mt-6 rounded-3xl glass p-5">
      <h2 className="mb-1 text-center text-xl font-black">
        ⚽ <span className="gradient-text">Matches</span>
      </h2>
      <p className="mb-3 text-center text-xs font-medium text-stone-300">
        See everyone&apos;s predictions, match by match
      </p>
      <div className="mb-4 flex justify-center">
        <Link
          href="/t"
          prefetch={false}
          className={`rounded-full chrome px-4 py-1.5 text-xs font-bold text-violet-300 transition active:scale-95 ${FOCUS_RING}`}
        >
          🌐 Browse teams →
        </Link>
      </div>

      {current.length > 0 ? (
        <ul className="space-y-2">
          {current.map((m) => (
            <MatchRow key={m.id} code={code} match={m} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl glass px-4 py-3 text-center text-sm font-medium text-stone-400">
          No live or upcoming matches right now.
        </p>
      )}

      {finished.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-center">
            <button
              onClick={() => setShowFinished((v) => !v)}
              aria-expanded={showFinished}
              className={`rounded-full chrome px-4 py-2 text-sm font-bold text-violet-300 transition active:scale-95 ${FOCUS_RING}`}
            >
              {showFinished
                ? "Hide finished"
                : `Show finished (${finished.length}) →`}
            </button>
          </div>
          {showFinished && (
            <ul className="mt-3 space-y-2">
              {finished.map((m) => (
                <MatchRow key={m.id} code={code} match={m} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
