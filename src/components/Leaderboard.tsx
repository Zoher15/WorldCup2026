"use client";

import { useState } from "react";
import { PlayerLink } from "./PlayerLink";
import { ShareLeaderboard } from "./ShareLeaderboard";
import { FOCUS_RING } from "./theme";
import { useLiveRefresh } from "./useLiveRefresh";
import type { Standings } from "@/lib/standings";

const TABS = [
  { key: "overall", label: "Overall" },
  { key: "win", label: "Win predictor" },
  { key: "scoreline", label: "Scoreline" },
] as const;

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_BG = [
  "from-sunburst to-flame",
  "from-stone-200 to-stone-400",
  "from-orange-300 to-orange-500",
];
// Render order places #1 in the middle, #2 left, #3 right.
const PODIUM_ORDER = [1, 0, 2];
// Indexed by rank (0 = 1st): the winner's bar is tallest, descending from there.
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

export function Leaderboard({
  data,
  code,
  groupName,
  live = false,
}: {
  data: Standings;
  code?: string;
  groupName?: string;
  /** A match is in play — points are provisional; tick the board on a timer and
   *  flag it so people know the totals can still move. */
  live?: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overall");
  const [expanded, setExpanded] = useState(false);
  const rows = data[tab];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  // Show the top 10 (podium + 7) by default so the share button stays in reach;
  // the rest is revealed on demand via the expander above the share button.
  const COLLAPSED_TOTAL = 10;
  const collapsedRest = rest.slice(0, COLLAPSED_TOTAL - top3.length);
  const shownRest = expanded ? rest : collapsedRest;
  const canExpand = rest.length > collapsedRest.length;

  // Refresh the board while a match is live so provisional points keep up.
  useLiveRefresh(live);

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

      {/* Tabs: the active tab is a solid chrome pill with a 2px brand-gradient
          underline (the hero headline's flame→grape→ocean, echoed small). */}
      <div className="mb-5 flex justify-center gap-1 rounded-full glass p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition ${FOCUS_RING} ${
              tab === t.key
                ? "chrome text-grape dark:text-violet-300"
                : "text-stone-500 hover:text-stone-700 dark:text-stone-300 dark:hover:text-white"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span
                aria-hidden
                className="gradient-accent absolute inset-x-4 bottom-[3px] h-0.5 rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Podium */}
      <div className="mb-5 flex items-end justify-center gap-3">
        {PODIUM_ORDER.map((idx, slot) => {
          const r = top3[idx];
          if (!r)
            return (
              <div key={slot} className="w-20 max-sm:max-w-24 max-sm:flex-1 max-sm:w-auto" />
            );
          return (
            <div
              key={slot}
              className="flex w-20 flex-col items-center max-sm:max-w-24 max-sm:flex-1 max-sm:w-auto"
            >
              <div className="text-2xl">{MEDALS[idx]}</div>
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
              <div className={`relative w-full ${PODIUM_HEIGHT[idx]}`}>
                <div
                  className={`absolute inset-0 rounded-t-xl bg-gradient-to-b ${PODIUM_BG[idx]}`}
                />
                <div className="absolute inset-0 rounded-t-xl glass" />
                <div className="relative flex h-full items-start justify-center pt-1 font-display text-stone-800 dark:text-stone-50">
                  {r.points}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* The rest */}
      <ol className="space-y-2">
        {shownRest.map((r, i) => (
          <li
            key={r.userId}
            className="flex items-center gap-3 rounded-2xl glass px-4 py-3 text-stone-700 dark:text-stone-100"
          >
            <span className="w-6 text-center font-black text-stone-400">
              {i + 4}
            </span>
            <PlayerLink
              userId={r.userId}
              code={code}
              title={r.displayName}
              className="flex-1 truncate font-bold"
            >
              {r.displayName}
            </PlayerLink>
            <Movement value={r.movement} />
            <span className="w-10 text-right font-display text-lg tabular-nums">
              {r.points}
            </span>
          </li>
        ))}
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
