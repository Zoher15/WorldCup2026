"use client";

import { useState } from "react";
import { MatchCard } from "./MatchCard";
import { computeBreakdown } from "@/lib/score-breakdown";
import { teamLabel } from "@/lib/fifa";
import { SCORE_MULTIPLIER } from "@/lib/scoring";

// A fixed demo tie: a Round-of-16 game that ends level and is settled on
// penalties, with Brazil going through. The player drives the card — call the
// score, and on a draw, pick who advances — to see the mechanic pay off.
const HOME = "BRA";
const AWAY = "ESP";
const KICKOFF = "2026-07-04T19:00:00.000Z";
const STAGE = "round_of_16" as const;
const RESULT = { home: 1, away: 1, advancedCode: HOME };

const homeName = teamLabel(HOME);
const awayName = teamLabel(AWAY);

/**
 * A self-contained match card for the how-to-play page that demonstrates the
 * knockout advance pick: enter a level score and the real "who goes through?"
 * picker appears under the teams; the readout below scores it live against a
 * tie Brazil win on penalties, so the player can feel a right vs wrong call.
 */
export function KnockoutAdvanceDemo() {
  const [pick, setPick] = useState<{
    home: number;
    away: number;
    advance: string | null;
  }>({ home: 1, away: 1, advance: HOME });

  const draw = pick.home === pick.away;
  const b = computeBreakdown({
    // Off a non-draw scoreline the advance pick is irrelevant (the scoreline
    // names the winner) — mirror how a real save drops it.
    pick: { home: pick.home, away: pick.away, advancePick: draw ? pick.advance : null },
    result: RESULT,
    stage: STAGE,
    homeCode: HOME,
    awayCode: AWAY,
  });

  // The verdict line, keyed to what the player has called — so the same card
  // teaches the full 5 / nothing / one-step-off outcomes as they experiment.
  let verdict: { tone: string; text: React.ReactNode };
  if (!draw) {
    const winnerName = pick.home > pick.away ? homeName : awayName;
    const right = pick.home > pick.away; // HOME = Brazil, the side that advanced
    verdict = right
      ? {
          tone: "text-emerald-400",
          text: (
            <>
              You called {homeName} to win outright — they went through, so that&apos;s
              the full <strong>5</strong> for the outcome.
            </>
          ),
        }
      : {
          tone: "text-flame",
          text: (
            <>
              You called {winnerName} to win, but {homeName} went through — the wrong
              winner scores <strong>0</strong> for the outcome.
            </>
          ),
        };
  } else if (pick.advance === HOME) {
    verdict = {
      tone: "text-emerald-400",
      text: (
        <>
          You called a draw and backed {homeName} to go through — and they did. That
          pick is graded like calling the winner, so it&apos;s the full{" "}
          <strong>5</strong> for the outcome.
        </>
      ),
    };
  } else if (pick.advance === AWAY) {
    verdict = {
      tone: "text-flame",
      text: (
        <>
          You called a draw but backed {awayName} — {homeName} went through, so your
          winner call is wrong: <strong>0</strong> for the outcome. The pick is a
          real bet.
        </>
      ),
    };
  } else {
    verdict = {
      tone: "text-sky-400",
      text: (
        <>
          You called a draw but didn&apos;t say who advances — that&apos;s one step
          off, <strong>2</strong>. Tap a team above to go for the full{" "}
          <strong>5</strong>.
        </>
      ),
    };
  }

  return (
    <div className="mx-auto max-w-sm">
      <MatchCard
        data={{
          homeCode: HOME,
          awayCode: AWAY,
          kickoffAt: KICKOFF,
          stage: STAGE,
          state: "open",
        }}
        entry={{
          home: pick.home,
          away: pick.away,
          onChange: (side, n) => setPick((p) => ({ ...p, [side]: n })),
          advance: pick.advance,
          onAdvanceChange: (code) => setPick((p) => ({ ...p, advance: code })),
        }}
      />

      <div className="mt-3 rounded-2xl glass p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
          Suppose it ends 1–1 · {homeName} win on penalties
        </p>
        <p className="mt-1.5 text-sm font-medium text-stone-200">{verdict.text}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-sm font-bold text-stone-300">
          <span className={verdict.tone}>{b.outcome} outcome</span>
          <span className="text-stone-500">+</span>
          <span className="text-sky-400">{b.closeness} closeness</span>
          <span className="text-stone-500">×{SCORE_MULTIPLIER[STAGE]}</span>
          <span className="text-stone-500">=</span>
          <span className="font-black text-emerald-400">{b.total} pts</span>
        </div>
      </div>
    </div>
  );
}
