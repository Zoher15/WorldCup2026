import Link from "next/link";
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
      <span className="inline-flex items-center gap-1.5 text-flame">
        <span className="live-dot h-2 w-2 rounded-full bg-flame" />
        <span className="font-black tabular-nums">
          {match.homeGoals}–{match.awayGoals}
        </span>
      </span>
    );
  }
  if (match.state === "locked") {
    if (match.isFinished && hasScore) {
      return (
        <span className="font-black tabular-nums text-pitch dark:text-emerald-400">
          {match.homeGoals}–{match.awayGoals}
          <span className="ml-1 text-[10px] font-bold text-stone-400">FT</span>
        </span>
      );
    }
    return <span className="text-xs font-bold text-stone-400">In play</span>;
  }
  if (match.state === "open") {
    return (
      <span className="text-xs font-bold text-flame">⏳ Open</span>
    );
  }
  return (
    <span className="text-xs font-medium text-stone-400">
      {formatKickoffDateTime(match.kickoffAt)}
    </span>
  );
}

/** A group's matches as entry points to each one's per-match leaderboard. */
export function GroupMatches({
  code,
  matches,
}: {
  code: string;
  matches: BoardMatchSummary[];
}) {
  if (matches.length === 0) return null;

  return (
    <section className="mt-6 rounded-3xl glass p-5">
      <h2 className="mb-1 text-center text-xl font-black text-grape dark:text-violet-300">
        ⚽ Matches
      </h2>
      <p className="mb-4 text-center text-xs font-medium text-stone-500 dark:text-stone-300">
        See everyone&apos;s predictions, match by match
      </p>

      <ul className="space-y-2">
        {matches.map((m) => (
          <li key={m.id}>
            <Link
              href={`/g/${code}/m/${m.id}`}
              prefetch={false}
              className="flex items-center gap-3 rounded-2xl glass px-4 py-2.5 transition active:scale-[0.99]"
            >
              <span className="hidden w-24 shrink-0 truncate text-[11px] font-bold uppercase tracking-wide text-stone-400 sm:block">
                {formatStageLabel(m.groupLabel, m.stage)}
              </span>
              <span className="min-w-0 flex-1 truncate font-bold text-stone-800 dark:text-stone-100">
                {teamLabel(m.homeCode, m.homeLabel)}
                <span className="px-1.5 text-stone-400">v</span>
                {teamLabel(m.awayCode, m.awayLabel)}
              </span>
              <MatchStatus match={m} />
              <span className="text-grape dark:text-violet-300">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
