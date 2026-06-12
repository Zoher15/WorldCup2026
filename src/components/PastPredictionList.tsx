"use client";

import { MatchCard } from "./MatchCard";
import { groupByDate } from "@/lib/group-by-date";
import type { PastPrediction } from "@/lib/predictions";

/** The viewer's finished matches as full-time scoreboards — "your call" beside
 *  the result, tap for the points math. Same card as everywhere else. */
export function PastPredictionList({ matches }: { matches: PastPrediction[] }) {
  // Group under date headings, preserving the (newest-first) order.
  const groups = groupByDate(matches);

  return (
    <div>
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
