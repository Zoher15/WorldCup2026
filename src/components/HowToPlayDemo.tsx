"use client";

import { useState } from "react";
import { MatchCard } from "./MatchCard";
import { scoreMatch, type MatchScore } from "@/lib/scoring";

// A fixed demo fixture so the walkthrough always tells the same little story.
const HOME = "BRA";
const AWAY = "ESP";
const KICKOFF = "2026-07-19T19:00:00.000Z";
const RESULT = { home: 2, away: 1 };

// A few imaginary friends and the scores they called, to show the spread.
const FRIENDS = [
  { name: "Maya", home: 2, away: 1 }, // spot on
  { name: "Dad", home: 1, away: 0 }, // right winner, a goal off
  { name: "Priya", home: 1, away: 1 }, // called a draw
  { name: "Sam", home: 0, away: 2 }, // wrong winner
];

const MEDALS = ["🥇", "🥈", "🥉"];

function scoreOf(home: number, away: number): MatchScore {
  return scoreMatch(
    { homeGoals: home, awayGoals: away },
    { homeGoals: RESULT.home, awayGoals: RESULT.away },
  );
}

export function HowToPlayDemo() {
  const [pick, setPick] = useState({ home: 1, away: 1 });
  const [locked, setLocked] = useState(false);

  const you = scoreOf(pick.home, pick.away);

  // Everyone (friends + you) ranked by points, for the reveal.
  const board = [
    ...FRIENDS.map((f) => ({
      name: f.name,
      home: f.home,
      away: f.away,
      you: false,
      score: scoreOf(f.home, f.away),
    })),
    { name: "You", home: pick.home, away: pick.away, you: true, score: you },
  ].sort((a, b) => b.score.total - a.score.total);

  return (
    <div>
      <MatchCard
        data={{
          homeCode: HOME,
          awayCode: AWAY,
          kickoffAt: KICKOFF,
          stage: "group",
          groupLabel: "F",
          state: locked ? "final" : "open",
          homeGoals: locked ? RESULT.home : undefined,
          awayGoals: locked ? RESULT.away : undefined,
        }}
        entry={
          locked
            ? undefined
            : {
                home: pick.home,
                away: pick.away,
                onChange: (side, n) => setPick((p) => ({ ...p, [side]: n })),
              }
        }
        footer={
          locked ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-stone-500">
                Your pick{" "}
                <span className="text-grape">
                  {pick.home}–{pick.away}
                </span>
              </span>
              <span className="rounded-full bg-pitch/15 px-2.5 py-0.5 font-black text-pitch">
                +{you.total} pts
              </span>
            </div>
          ) : undefined
        }
      />

      {!locked ? (
        <div className="mt-4 text-center">
          <p className="mb-3 text-sm font-medium text-stone-500 dark:text-stone-300">
            Tap the <strong>+/−</strong> to call the score, then lock it in.
          </p>
          <button
            onClick={() => setLocked(true)}
            className="rounded-full bg-pitch px-6 py-3 font-bold text-white shadow transition active:scale-95"
          >
            Lock in my prediction →
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <div className="rounded-2xl bg-grape/10 p-4 text-center dark:bg-grape/20">
            <p className="text-sm font-medium text-stone-600 dark:text-stone-200">
              Final score <strong className="text-ocean">{RESULT.home}–{RESULT.away}</strong>. You
              scored{" "}
              <strong className="text-pitch">{you.total} points</strong> —{" "}
              {you.outcome} for the outcome + {you.closeness} for closeness.
            </p>
          </div>

          <h3 className="mt-5 mb-2 text-center text-sm font-black uppercase tracking-wide text-stone-400">
            How everyone did
          </h3>
          <ol className="space-y-2">
            {board.map((r, i) => (
              <li
                key={r.name}
                className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 dark:text-stone-100 ${
                  r.you
                    ? "bg-sunburst/30 shadow ring-1 ring-flame/30"
                    : "glass"
                }`}
              >
                <span className="w-6 text-center text-lg font-black">
                  {MEDALS[i] ?? <span className="text-stone-400">{i + 1}</span>}
                </span>
                <span className="flex-1 truncate font-bold text-stone-700 dark:text-stone-100">
                  {r.name}
                  {r.you && (
                    <span className="ml-1.5 text-xs font-bold text-flame">(you)</span>
                  )}
                </span>
                <span className="text-sm font-bold text-grape tabular-nums">
                  {r.home}–{r.away}
                </span>
                <span className="w-14 text-right font-black tabular-nums text-pitch">
                  {r.score.total} pts
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-4 text-center">
            <button
              onClick={() => setLocked(false)}
              className="rounded-full glass px-6 py-3 font-bold text-grape transition active:scale-95 dark:text-violet-300"
            >
              ↺ Try a different score
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
