"use client";

import { useState } from "react";
import Link from "next/link";
import type { Standings, StandingsRow } from "@/lib/standings";

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
const PODIUM_HEIGHT = ["h-20", "h-28", "h-16"];

function Movement({ value }: { value: number }) {
  if (value === 0)
    return <span className="text-xs font-bold text-stone-300">—</span>;
  const up = value > 0;
  return (
    <span
      className={`text-xs font-bold ${up ? "text-pitch" : "text-flame"}`}
      title={`${up ? "Up" : "Down"} ${Math.abs(value)}`}
    >
      {up ? "▲" : "▼"} {Math.abs(value)}
    </span>
  );
}

/** A player's name, linked to their in-group profile when a group code is set. */
function PlayerName({
  row,
  code,
  className,
}: {
  row: StandingsRow;
  code?: string;
  className?: string;
}) {
  if (!code) return <span className={className}>{row.displayName}</span>;
  return (
    <Link
      href={`/g/${code}/p/${row.userId}`}
      className={`${className ?? ""} hover:underline`}
    >
      {row.displayName}
    </Link>
  );
}

export function Leaderboard({ data, code }: { data: Standings; code?: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overall");
  const rows = data[tab];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="rounded-3xl glass p-5">
      <h2 className="mb-4 text-center text-2xl font-black text-grape dark:text-violet-300">
        🏆 Leaderboard
      </h2>

      {/* Tabs */}
      <div className="mb-5 flex justify-center gap-1 rounded-full bg-stone-100 p-1 dark:bg-stone-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-bold transition ${
              tab === t.key
                ? "bg-grape text-white shadow"
                : "text-stone-500 hover:text-stone-700 dark:text-stone-300 dark:hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Podium */}
      <div className="mb-5 flex items-end justify-center gap-3">
        {PODIUM_ORDER.map((idx, slot) => {
          const r = top3[idx];
          if (!r) return <div key={slot} className="w-20" />;
          return (
            <div key={slot} className="flex w-20 flex-col items-center">
              <div className="text-2xl">{MEDALS[idx]}</div>
              <PlayerName
                row={r}
                code={code}
                className="mb-1 max-w-full truncate text-xs font-bold"
              />
              <div
                className={`flex w-full ${PODIUM_HEIGHT[idx]} items-start justify-center rounded-t-xl bg-gradient-to-b ${PODIUM_BG[idx]} pt-1 font-black text-white shadow-inner`}
              >
                {r.points}
              </div>
            </div>
          );
        })}
      </div>

      {/* The rest */}
      <ol className="space-y-2">
        {rest.map((r, i) => (
          <li
            key={r.userId}
            className="flex items-center gap-3 rounded-2xl glass px-4 py-2.5 text-stone-700 dark:text-stone-100"
          >
            <span className="w-6 text-center font-black text-stone-400">
              {i + 4}
            </span>
            <PlayerName row={r} code={code} className="flex-1 truncate font-bold" />
            <Movement value={r.movement} />
            <span className="w-10 text-right text-lg font-extrabold tabular-nums">
              {r.points}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
