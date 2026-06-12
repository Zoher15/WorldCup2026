"use client";

import { useEffect, useMemo, useState } from "react";
import { MatchCard } from "./MatchCard";
import { FOCUS_RING } from "./theme";
import { groupByDate } from "@/lib/group-by-date";
import { computeBreakdown } from "@/lib/score-breakdown";
import { teamLabel } from "@/lib/fifa";
import type { PastPrediction } from "@/lib/predictions";

/** A pick worth shouting about — the share nudge appears at this score or up. */
const NUDGE_MIN_POINTS = 8;

/** The most recent finished match where the viewer's pick scored big — the
 *  candidate for the share nudge. Matches arrive newest-first, so the first
 *  qualifying hit is the freshest brag. */
function findBigWin(matches: PastPrediction[]) {
  for (const m of matches) {
    if (!m.pick || m.isTrial) continue;
    const { total } = computeBreakdown({
      pick: m.pick,
      result: m.result,
      stage: m.stage,
      homeCode: m.homeCode,
      awayCode: m.awayCode,
    });
    if (total >= NUDGE_MIN_POINTS) return { match: m, pick: m.pick, total };
  }
  return null;
}

/** A dismissible "great call — share it" banner over the viewer's latest big
 *  score. Dismissal is remembered per match in localStorage, so each brag only
 *  nudges once. */
function ShareNudge({ matches }: { matches: PastPrediction[] }) {
  const win = useMemo(() => findBigWin(matches), [matches]);
  // localStorage (and navigator) are browser-only, so visibility resolves in an
  // effect — the server and the first client render agree on "hidden", which
  // avoids a hydration mismatch.
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const storageKey = win ? `shareNudge:${win.match.id}` : null;

  useEffect(() => {
    if (storageKey && !localStorage.getItem(storageKey)) setVisible(true);
  }, [storageKey]);

  if (!win || !visible) return null;
  const { match, pick, total } = win;
  const home = teamLabel(match.homeCode, match.homeLabel);
  const away = teamLabel(match.awayCode, match.awayLabel);

  async function share() {
    const text = `I called ${home} ${pick.home}–${pick.away} ${away} and scored ${total} points predicting the World Cup! ⚽`;
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
    } catch {
      // A dismissed share sheet (or a denied clipboard) needs no follow-up.
    }
  }

  function dismiss() {
    if (storageKey) localStorage.setItem(storageKey, "1");
    setVisible(false);
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl glass px-4 py-3">
      <p className="min-w-0 flex-1 text-sm font-bold text-stone-700 dark:text-stone-100">
        🎯 Great call on {home}–{away}! Share it with your group
      </p>
      <button
        onClick={share}
        className={`shrink-0 rounded-full chrome px-4 py-2 text-sm font-bold text-pitch transition active:scale-95 dark:text-emerald-400 ${FOCUS_RING}`}
      >
        {copied ? "Copied ✓" : "Share"}
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className={`shrink-0 rounded-full px-2 py-1 text-sm font-bold text-stone-400 transition hover:text-stone-600 active:scale-95 dark:hover:text-stone-200 ${FOCUS_RING}`}
      >
        ✕
      </button>
    </div>
  );
}

/** The viewer's finished matches as full-time scoreboards — "your call" beside
 *  the result, tap for the points math. Same card as everywhere else. */
export function PastPredictionList({ matches }: { matches: PastPrediction[] }) {
  // Group under date headings, preserving the (newest-first) order.
  const groups = groupByDate(matches);

  return (
    <div>
      <ShareNudge matches={matches} />
      {groups.map((g) => (
        <section key={g.date} className="mb-6">
          <h3 className="mb-2 px-1 text-sm font-black uppercase tracking-wide text-stone-400">
            {g.date}
          </h3>
          {/* Two columns once there's room (the page caps at max-w-3xl, where a
              third column would squeeze the cards below a readable width). */}
          <div className="grid gap-6 sm:grid-cols-2">
            {g.items.map((m) => (
              <MatchCard
                key={m.id}
                data={{
                  homeCode: m.homeCode,
                  awayCode: m.awayCode,
                  homeLabel: m.homeLabel,
                  awayLabel: m.awayLabel,
                  kickoffAt: m.kickoffAt,
                  stage: m.stage,
                  groupLabel: m.groupLabel,
                  venue: m.venue,
                  state: "final",
                  homeGoals: m.result.home,
                  awayGoals: m.result.away,
                  advancedCode: m.result.advancedCode,
                }}
                pick={m.pick}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
