"use client";

import { MatchCard, toMatchCardData } from "./MatchCard";
import { useLiveRefresh } from "./useLiveRefresh";
import { isFinal, isInPlay } from "@/lib/match-predicates";
import type { TeamMatchRow, TeamOutcome } from "@/lib/team";

/** The team's own result on a finished card — a compact win/draw/loss chip in
 *  the card header, so a schedule scans at a glance. Penalties settle knockouts,
 *  so the label matches (a shootout win reads "Won", not "Drew"). */
const OUTCOME_STYLE: Record<TeamOutcome, { label: string; tone: string }> = {
  W: { label: "Won", tone: "text-emerald-400" },
  D: { label: "Drew", tone: "text-sky-400" },
  L: { label: "Lost", tone: "text-flame" },
};

function OutcomeChip({ outcome }: { outcome: TeamOutcome }) {
  const { label, tone } = OUTCOME_STYLE[outcome];
  return <span className={`font-black ${tone}`}>{label}</span>;
}

/** One country match, as the shared scoreboard. No pick — a team page is about
 *  the games themselves; each card deep-links to the per-match predictions hub,
 *  and the two names link on to the other country's schedule. */
function TeamCard({ row }: { row: TeamMatchRow }) {
  return (
    <MatchCard
      data={toMatchCardData(row)}
      linkTeams
      status={row.outcome ? <OutcomeChip outcome={row.outcome} /> : undefined}
      detailHref={`/m/${row.matchId}`}
    />
  );
}

function Section({
  title,
  rows,
}: {
  title: React.ReactNode;
  rows: TeamMatchRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-stone-400">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {rows.map((r) => (
          <TeamCard key={r.matchId} row={r} />
        ))}
      </div>
    </section>
  );
}

/**
 * A country's schedule: live games, then upcoming fixtures, then past results
 * (most-recent first) — the team-side mirror of a player's predictions split.
 * Ticks scores forward while any of the team's games is in play.
 */
export function TeamSchedule({ rows }: { rows: TeamMatchRow[] }) {
  const inPlay = rows.filter(isInPlay);
  const upcoming = rows.filter((r) => r.state !== "locked");
  const past = rows.filter(isFinal).reverse();

  useLiveRefresh(inPlay.length > 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl glass p-6 text-center font-medium text-stone-300">
        <div className="mb-2 text-4xl">⚽</div>
        No fixtures scheduled yet — check back once the draw is set.
      </div>
    );
  }

  return (
    <div>
      <Section
        title={
          <span className="inline-flex items-center gap-1.5">
            <span className="live-dot h-2 w-2 rounded-full bg-flame" />
            Live now
          </span>
        }
        rows={inPlay}
      />
      <Section title="Upcoming" rows={upcoming} />
      <Section title="Past results" rows={past} />
    </div>
  );
}
