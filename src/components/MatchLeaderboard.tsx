"use client";

import { useState } from "react";
import { BreakdownRow } from "./BreakdownRow";
import { CountUp } from "./CountUp";
import { Icon } from "./Icon";
import { InfoBadge } from "./InfoBadge";
import { MatchCard, toMatchCardData } from "./MatchCard";
import { PlayerLink } from "./PlayerLink";
import { FOCUS_RING, LIVE_TEXT, PREDICTION_TEXT, RESULT_TEXT } from "./theme";
import { useLiveRefresh } from "./useLiveRefresh";
import type { MatchBoard, MatchBoardRow } from "@/lib/match-leaderboard";

/** Whether a revealed row has a points breakdown to expand (a scored pick that
 *  counts). The non-scored states show a static call only. */
function isScored(row: MatchBoardRow): boolean {
  return (
    row.hasPrediction &&
    row.counts &&
    row.points != null &&
    row.breakdown != null
  );
}

/** The inline right-hand status for a revealed row: the player's call + points.
 *  Static for the non-scored states; a tap-for-math toggle when there's a
 *  breakdown. The breakdown itself renders BELOW the row (ScoreBreakdown), not in
 *  this cluster, so expanding it never squeezes the name to nothing. */
function ScoreTrigger({
  row,
  open,
  onToggle,
}: {
  row: MatchBoardRow;
  open: boolean;
  onToggle: () => void;
}) {
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

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-1 text-sm transition active:scale-95 ${FOCUS_RING}`}
    >
      {call}
      <span
        className={`font-black tabular-nums ${
          row.provisional ? LIVE_TEXT : RESULT_TEXT
        }`}
      >
        {row.provisional ? "~" : ""}
        <CountUp value={row.points} />
        {/* "pts" only where there's room: on phones the bare number keeps the
            pill narrow so the name gets the width. The tap-expand below still
            spells out "Total … pts", so the unit is never lost. */}
        <span className="hidden sm:inline"> pt{row.points === 1 ? "" : "s"}</span>
      </span>
      <span className="text-stone-400">
        <Icon name={open ? "chevron-up" : "chevron-down"} className="text-[10px]" />
      </span>
    </button>
  );
}

/** The points math for a scored row, revealed on tap. Rendered as a full-width
 *  block UNDER the row's main line (not inside the right-hand cluster), so opening
 *  it gives the breakdown room to read and never steals width from the name. On
 *  wider screens it tucks to the right under the score, near where it was. */
function ScoreBreakdown({ row }: { row: MatchBoardRow }) {
  const b = row.breakdown!;
  return (
    <div className="mt-2 rounded-xl glass px-3 py-2 text-left sm:ml-auto sm:w-64">
      <BreakdownRow label="Right result" value={b.outcome} max={5} />
      <BreakdownRow label="Scoreline closeness" value={b.closeness} max={5} />
      {b.knockout && b.multiplier !== 1 && (
        <div className="flex items-center justify-between py-0.5 text-[11px] font-bold">
          <span className="text-stone-300">Knockout round</span>
          <span className="tabular-nums text-stone-100">×{b.multiplier}</span>
        </div>
      )}
      <div className="mt-1 flex items-center justify-between border-stone-600/60 pt-1">
        <span className="text-[11px] font-black uppercase tracking-wide text-stone-200">
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
  );
}

/** A player's name, linked to their in-group profile (except the bot). It wraps
 *  onto a second line (and only then clips, via line-clamp) rather than truncating
 *  on one — so a name squeezed by the score never collapses to a single letter
 *  ("C…"). `break-words` lets a long single token (e.g. the bot's "BoringBot")
 *  break across the two lines instead of overflowing into the score. The "(you)"
 *  tag lives outside this element so it isn't clipped away. */
function PlayerName({ row, code }: { row: MatchBoardRow; code: string }) {
  return (
    <PlayerLink
      userId={row.userId}
      code={row.isBot ? undefined : code}
      title={row.displayName}
      className="min-w-0 flex-1 break-words font-bold text-stone-100 line-clamp-2"
    >
      {row.displayName}
    </PlayerLink>
  );
}

/** "Called it against the group" flag, parked on the right next to the score so
 *  a long name never collides with it. The label is hidden on narrow screens
 *  (it would crowd the row), so the badge is tappable: a tap reveals an explainer
 *  popover — the same context hover gives on wider screens. Right-aligned so the
 *  popover opens inward from the row's right edge. */
function UpsetBadge() {
  return (
    <InfoBadge
      label="Called it against the group's consensus"
      align="right"
      triggerClassName="rounded-full glass px-2 py-0.5 text-[10px] font-bold text-sunburst"
      explainer={
        <>
          🔮 <strong className="text-sunburst">Against the crowd</strong> — called
          it right while most of the group got it wrong.
        </>
      }
    >
      🔮<span className="hidden sm:inline"> Against the crowd</span>
    </InfoBadge>
  );
}

/** One ranked row: rank + name on the main line, the call/points trigger on the
 *  right, and — when a scored row is tapped open — the points breakdown dropped
 *  full-width underneath. Holds its own open state; rendered as a flex COLUMN so
 *  the breakdown sits below the row rather than inside the horizontal cluster. */
function MatchRow({
  row,
  code,
  rank,
  revealed,
}: {
  row: MatchBoardRow;
  code: string;
  rank: number | null;
  revealed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const scored = revealed && isScored(row);

  return (
    <li
      className={`flex flex-col rounded-2xl px-4 py-2.5 transition hover:scale-[1.01] ${
        row.isViewer ? "glass ring-2 ring-violet-300/40" : "glass"
      }`}
    >
      <div className="flex items-center gap-3">
        {revealed && (
          <span className="w-6 shrink-0 text-center font-black text-stone-400 tabular-nums">
            {rank ?? "—"}
          </span>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <PlayerName row={row} code={code} />
          {row.isViewer && (
            <span className="shrink-0 text-[10px] font-bold text-stone-400">
              (you)
            </span>
          )}
        </div>
        {/* Right side: the upset flag sits beside the score, so the name keeps
            the whole left side and wraps clear of both. */}
        <div className="flex shrink-0 items-center gap-2">
          {row.upset && <UpsetBadge />}
          {revealed ? (
            <ScoreTrigger row={row} open={open} onToggle={() => setOpen((o) => !o)} />
          ) : row.hasPrediction ? (
            <span className="text-xs font-bold text-emerald-400">✓ Entered</span>
          ) : (
            <span className="text-xs font-bold text-stone-400">Not entered</span>
          )}
        </div>
      </div>
      {scored && open && <ScoreBreakdown row={row} />}
    </li>
  );
}

/** The ranked picks for ONE group's board (heading + summary + the list), with
 *  no match card. Presentational — the caller drives any live refresh. Reused by
 *  the single-group page and by each collapsible group in the cross-group hub. */
export function MatchBoardRows({ board }: { board: MatchBoard }) {
  const { rows, revealed, summary, group } = board;

  // Standard competition ranking (1, 1, 3) over the scored rows; un-scored picks
  // get no medal number.
  let lastPoints: number | null = null;
  let lastRank = 0;

  return (
    <div className="rounded-3xl glass p-5">
        <h2 className="mb-1 text-center text-xl font-black">
          {revealed && "🏅 "}
          <span className="gradient-text">
            {revealed ? "This match" : "Who's locked in"}
          </span>
        </h2>
        <p className="mb-4 text-center text-xs font-medium text-stone-300">
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
              <MatchRow
                key={r.userId}
                row={r}
                code={group.code}
                rank={rank}
                revealed={revealed}
              />
            );
          })}
        </ol>
    </div>
  );
}

export function MatchLeaderboard({ board }: { board: MatchBoard }) {
  // Tick live points forward while the match is in play.
  useLiveRefresh(board.match.live != null);

  return (
    <div>
      <MatchCard data={toMatchCardData(board.match)} pick={null} />
      <div className="mt-6">
        <MatchBoardRows board={board} />
      </div>
    </div>
  );
}
