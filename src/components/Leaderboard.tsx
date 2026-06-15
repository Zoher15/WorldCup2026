"use client";

import { useEffect, useRef, useState } from "react";
import { InfoBadge } from "./InfoBadge";
import { PlayerLink } from "./PlayerLink";
import { ShareLeaderboard } from "./ShareLeaderboard";
import { FOCUS_RING } from "./theme";
import { useLiveRefresh } from "./useLiveRefresh";
import { competitionRanks, type Standings } from "@/lib/standings";

const TABS = [
  { key: "overall", label: "Overall" },
  { key: "win", label: "Outcome predictor" },
  { key: "scoreline", label: "Scoreline" },
] as const;

// Medal, colour and height are all indexed by rank (0 = 1st), never by podium
// position — so tied places match: two co-leaders both stand on equal-height
// gold steps, two tied for 2nd on matching silver, and so on.
const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_BG = [
  "from-sunburst to-flame",
  "from-stone-200 to-stone-400",
  // Deep copper, not bright orange, so bronze never reads as a second gold.
  "from-amber-700 to-amber-900",
];
// Render order places #1 in the middle, #2 left, #3 right.
const PODIUM_ORDER = [1, 0, 2];
// The winner's bar is tallest, descending from there (by rank, so ties match).
const PODIUM_HEIGHT = ["h-28", "h-20", "h-16"];

function Movement({ value }: { value: number }) {
  if (value === 0)
    return <span className="text-xs font-bold text-stone-300">—</span>;
  const up = value > 0;
  return (
    <span
      className={`text-xs font-bold ${up ? "text-pitch dark:text-emerald-400" : "text-flame"}`}
      title={`${up ? "Up" : "Down"} ${Math.abs(value)}`}
    >
      {up ? "▲" : "▼"} {Math.abs(value)}
    </span>
  );
}

/** The 🔥 scoring-streak flame, on the podium steps and the ranked rows alike.
 *  The glyph alone is cryptic, so it's tappable for a plain-language gloss (a
 *  hover `title` covers the desktop). `font-sans` resets the podium's display
 *  font for the count; harmless on the rows, which are sans already. `align`
 *  keeps the popover inside its column — the side podium steps open inward. */
function StreakBadge({
  streak,
  align,
}: {
  streak: number;
  align?: "left" | "center" | "right";
}) {
  return (
    <InfoBadge
      label={`${streak} correct results in a row`}
      align={align}
      triggerClassName="font-sans text-[10px] font-bold text-flame"
      explainer={
        <>
          🔥 <strong className="text-flame">On a streak</strong> — called the
          right result in {streak} matches in a row.
        </>
      }
    >
      🔥{streak}
    </InfoBadge>
  );
}

export function Leaderboard({
  data,
  code,
  groupName,
  live = false,
  viewerId,
}: {
  data: Standings;
  code?: string;
  groupName?: string;
  /** A match is in play — points are provisional; tick the board on a timer and
   *  flag it so people know the totals can still move. */
  live?: boolean;
  /** The signed-in viewer, so their own row can carry the "you vs them" delta.
   *  Omitted where there's no viewer (the home-page demo board). */
  viewerId?: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overall");
  const [expanded, setExpanded] = useState(false);
  const rows = data[tab];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  // Tied players share a rank ("=4"), competition style.
  const ranks = competitionRanks(rows);
  const isTied = (i: number) =>
    (i > 0 && rows[i - 1].points === rows[i].points) ||
    (i < rows.length - 1 && rows[i + 1].points === rows[i].points);

  // "You vs them": one small motivating line for the viewer — every tie-mate
  // when level, crown on top, otherwise the gap to the player directly above.
  const viewerIdx = viewerId ? rows.findIndex((r) => r.userId === viewerId) : -1;
  let viewerDelta: string | null = null;
  if (viewerIdx >= 0) {
    const mine = rows[viewerIdx].points;
    const tiedOthers = rows.filter(
      (r, i) => i !== viewerIdx && r.points === mine,
    );
    if (tiedOthers.length > 0) {
      const lead = ranks[viewerIdx] === 1 ? "Tied for the lead with" : "Tied with";
      viewerDelta =
        tiedOthers.length === 1
          ? `${lead} ${tiedOthers[0].displayName}`
          : `${lead} ${tiedOthers.length} others`;
    } else if (viewerIdx === 0) {
      viewerDelta = "👑 Top of the group";
    } else {
      const ahead = rows[viewerIdx - 1];
      const gap = ahead.points - mine;
      viewerDelta = `${gap} pt${gap === 1 ? "" : "s"} behind ${ahead.displayName}`;
    }
  }
  // Show the top 10 (podium + 7) by default so the share button stays in reach;
  // the rest is revealed on demand via the expander above the share button.
  const COLLAPSED_TOTAL = 10;
  const collapsedRest = rest.slice(0, COLLAPSED_TOTAL - top3.length);
  const shownRest = expanded ? rest : collapsedRest;
  const canExpand = rest.length > collapsedRest.length;

  // Refresh the board while a match is live so provisional points keep up.
  useLiveRefresh(live);

  // Overtake flash: remember where each player ranked the last time this tab's
  // rows rendered (per tab, so switching tabs never cross-wires the boards).
  // When a live refresh swaps in new standings and someone has climbed, their
  // row — and podium slot — wears a brief gold wash. The server's `movement`
  // field can't drive this (buildStandings always emits 0), so the comparison
  // lives client-side: ranks in a ref (comparing never re-renders by itself),
  // and the climbers in state so the overlay *mounts* — the one-shot
  // `overtake-flash` CSS animation runs on mount — then unmounts once faded.
  // First sight of a tab only records, so page load never flashes.
  const prevRanks = useRef(new Map<string, Map<string, number>>());
  const [climbed, setClimbed] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const ranks = new Map(rows.map((r, i) => [r.userId, i]));
    const prev = prevRanks.current.get(tab);
    prevRanks.current.set(tab, ranks);
    if (!prev) return;
    const up = new Set<string>();
    for (const [id, rank] of ranks) {
      const before = prev.get(id);
      if (before !== undefined && rank < before) up.add(id);
    }
    if (up.size === 0) return;
    setClimbed(up);
    const t = setTimeout(() => setClimbed(new Set()), 1600);
    return () => clearTimeout(t);
  }, [rows, tab]);

  return (
    <div className="rounded-3xl glass p-5">
      <h2 className="mb-4 flex items-center justify-center gap-2 text-center text-2xl font-black text-grape dark:text-violet-300">
        🏆 Leaderboard
        {live && (
          <span className="inline-flex items-center gap-1 rounded-full glass px-2.5 py-0.5 text-xs font-bold text-flame">
            <span className="live-dot h-2 w-2 rounded-full bg-flame" />
            LIVE
          </span>
        )}
      </h2>
      {live && (
        <p className="-mt-2 mb-4 text-center text-xs font-medium text-stone-400">
          Points are provisional while matches are in play.
        </p>
      )}

      {/* Tabs: the active tab is a solid chrome pill; inactive tabs are muted
          text that brightens on hover. */}
      <div className="mb-5 flex justify-center gap-1 rounded-full glass p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition ${FOCUS_RING} ${
              tab === t.key
                ? "chrome text-grape dark:text-violet-300"
                : "text-stone-500 hover:text-stone-700 dark:text-stone-300 dark:hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Podium */}
      <div className="mb-5 flex items-end justify-center gap-3 max-sm:gap-2">
        {PODIUM_ORDER.map((idx, slot) => {
          const r = top3[idx];
          if (!r)
            return (
              <div key={slot} className="w-20 max-sm:max-w-24 max-sm:flex-1 max-sm:w-auto" />
            );
          // Rank (not podium position) drives the medal, colour and height, so
          // tied places match — two level at the top are both 🥇 on equal-height
          // gold steps, and the player below them takes 🥉.
          return (
            <div
              key={slot}
              // Steps rise into place on mount; the centre (winner) lands last
              // so the eye finishes on the gold. Keyed by slot, so this plays
              // once on first paint, not on every live refresh.
              className="rise-in flex w-20 flex-col items-center max-sm:max-w-24 max-sm:flex-1 max-sm:w-auto"
              style={{ animationDelay: slot === 1 ? "0.16s" : slot === 2 ? "0.08s" : "0s" }}
              title={isTied(idx) ? `Tied at ${r.points} pts` : undefined}
            >
              <div
                className={`mb-1 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] ${
                  ranks[idx] === 1 ? "text-3xl" : "text-2xl"
                }`}
              >
                {MEDALS[ranks[idx] - 1]}
              </div>
              {/* No profile to link to without a group (BoringBot has a synthetic one). */}
              <PlayerLink
                userId={r.userId}
                code={code}
                title={r.displayName}
                className="mb-1 max-w-full truncate text-xs font-bold"
              >
                {r.displayName}
              </PlayerLink>
              {/* Glass sheet floating over the vibrant medal gradient — the
                  gold/silver/bronze glows through the frost, matching the
                  "glass over flags" treatment on the match cards. */}
              <div className={`relative w-full ${PODIUM_HEIGHT[ranks[idx] - 1]}`}>
                <div
                  className={`absolute inset-0 overflow-hidden rounded-t-xl bg-gradient-to-b ${PODIUM_BG[ranks[idx] - 1]}${
                    ranks[idx] === 1 ? " shine" : ""
                  }`}
                />
                <div className="absolute inset-0 rounded-t-xl glass" />
                {/* Gold flash when a riser just took (or rose within) this slot. */}
                {climbed.has(r.userId) && (
                  <span
                    aria-hidden
                    className="overtake-flash pointer-events-none absolute inset-0 rounded-t-xl"
                  />
                )}
                <div className="relative flex h-full flex-col items-center gap-0.5 pt-1 font-display text-stone-800 dark:text-stone-50">
                  <span>
                    {isTied(idx) && (
                      <span className="mr-0.5 text-stone-500 dark:text-stone-300">=</span>
                    )}
                    {r.points}
                  </span>
                  {(r.streak ?? 0) >= 2 && (
                    <StreakBadge
                      streak={r.streak ?? 0}
                      align={slot === 0 ? "left" : slot === 2 ? "right" : "center"}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* A podium-placed viewer gets their delta line under the podium (their
          slot is too tight to carry an extra line without breaking alignment). */}
      {viewerIdx >= 0 && viewerIdx < 3 && viewerDelta && (
        <p className="-mt-3 mb-5 text-center text-xs font-medium text-stone-400">
          {viewerDelta}
        </p>
      )}

      {/* The rest */}
      <ol className="space-y-2">
        {shownRest.map((r, i) => {
          const rowIdx = i + top3.length;
          const tied = isTied(rowIdx);
          const streak = (r.streak ?? 0) >= 2 && (
            <StreakBadge streak={r.streak ?? 0} />
          );
          return (
          <li
            key={r.userId}
            // Rows settle in with a short stagger; `backwards` fill means the
            // entrance never pins the transform, so the hover lift still works.
            style={{ animationDelay: `${Math.min(i * 0.04, 0.28)}s` }}
            className="rise-in relative flex items-center gap-3 rounded-2xl glass px-4 py-3 text-stone-700 transition hover:scale-[1.01] dark:text-stone-100"
          >
            {/* Gold flash overlay (rather than animating the row's own
                background, which would fight the .glass layers) when this
                player climbed in the latest refresh. */}
            {climbed.has(r.userId) && (
              <span
                aria-hidden
                className="overtake-flash pointer-events-none absolute inset-0 rounded-2xl"
              />
            )}
            {/* Tied players share a rank ("=4"), competition style. */}
            <span
              className="w-7 text-center font-black text-stone-400 tabular-nums"
              title={tied ? `Tied at ${r.points} pts` : undefined}
            >
              {tied ? "=" : ""}
              {ranks[rowIdx]}
            </span>
            {viewerId === r.userId && viewerDelta ? (
              // The viewer's row: their name plus the small "you vs them" delta
              // tucked under it, inside the same flex slot so the rank, avatar
              // and points columns stay aligned with every other row.
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-1.5">
                  <PlayerLink
                    userId={r.userId}
                    code={code}
                    title={r.displayName}
                    className="truncate font-bold"
                  >
                    {r.displayName}
                  </PlayerLink>
                  {streak}
                </span>
                <span className="truncate text-xs font-medium text-stone-400">
                  {viewerDelta}
                </span>
              </span>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <PlayerLink
                  userId={r.userId}
                  code={code}
                  title={r.displayName}
                  className="truncate font-bold"
                >
                  {r.displayName}
                </PlayerLink>
                {streak}
              </span>
            )}
            <Movement value={r.movement} />
            <span className="w-10 text-right font-display text-lg tabular-nums">
              {r.points}
            </span>
          </li>
          );
        })}
      </ol>

      {(canExpand || code) && (
        <div className="mt-5 flex flex-col items-center gap-3">
          {canExpand && (
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={`rounded-full chrome px-4 py-2 text-sm font-bold text-grape transition active:scale-95 dark:text-violet-300 ${FOCUS_RING}`}
            >
              {expanded ? "Show less" : `Show all ${rows.length} →`}
            </button>
          )}
          {code && <ShareLeaderboard code={code} groupName={groupName} />}
        </div>
      )}
    </div>
  );
}
