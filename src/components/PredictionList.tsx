"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MatchCard } from "./MatchCard";
import { FOCUS_RING, LIVE_TEXT } from "./theme";
import { useLiveRefresh } from "./useLiveRefresh";
import { groupByDate } from "@/lib/group-by-date";
import { isLiveMatch } from "@/lib/match-predicates";
import { savePredictionsAction } from "@/app/predict/actions";
import type { MatchForPrediction, SavedPrediction } from "@/lib/predictions";

type Picks = Record<string, { home: number; away: number }>;

export function PredictionList({
  matches,
  initial,
}: {
  matches: MatchForPrediction[];
  initial: Record<string, SavedPrediction>;
}) {
  const router = useRouter();
  const [picks, setPicks] = useState<Picks>(() => {
    const p: Picks = {};
    for (const m of matches) {
      const saved = initial[m.id];
      p[m.id] = { home: saved?.predHome ?? 0, away: saved?.predAway ?? 0 };
    }
    return p;
  });
  const [savedSnapshot, setSavedSnapshot] = useState<Picks>(() => {
    const p: Picks = {};
    for (const [id, saved] of Object.entries(initial)) {
      p[id] = { home: saved.predHome, away: saved.predAway };
    }
    return p;
  });
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const openIds = useMemo(
    () => new Set(matches.filter((m) => m.state === "open").map((m) => m.id)),
    [matches],
  );

  // Tick the in-play score forward while any listed match is live.
  useLiveRefresh(matches.some(isLiveMatch));

  const dirtyIds = useMemo(
    () =>
      matches
        .filter((m) => {
          if (!openIds.has(m.id)) return false;
          const cur = picks[m.id];
          const snap = savedSnapshot[m.id];
          return !snap || snap.home !== cur.home || snap.away !== cur.away;
        })
        .map((m) => m.id),
    [matches, picks, savedSnapshot, openIds],
  );
  const dirtyIdSet = useMemo(() => new Set(dirtyIds), [dirtyIds]);

  const setPick = (id: string, side: "home" | "away", n: number) =>
    setPicks((p) => ({ ...p, [id]: { ...p[id], [side]: n } }));

  function save() {
    const items = dirtyIds.map((id) => ({
      matchId: id,
      predHome: picks[id].home,
      predAway: picks[id].away,
    }));
    startTransition(async () => {
      const res = await savePredictionsAction(items);
      if (!res.ok) {
        setFlash(res.error ?? "Save failed.");
        return;
      }
      setSavedSnapshot((snap) => {
        const next = { ...snap };
        for (const id of dirtyIds) next[id] = { ...picks[id] };
        return next;
      });
      setFlash(
        `Saved ${res.saved}${res.skipped ? ` · ${res.skipped} skipped` : ""} ✓`,
      );
    });
  }

  // Group matches under date headings, preserving kickoff order. Memoized so
  // editing a pick (which re-renders) doesn't rebuild the grouping.
  const groups = useMemo(() => groupByDate(matches), [matches]);

  // The single most urgent match gets the hero treatment: the first live match
  // if one's in play, else the first open match of the first date group.
  const heroId = useMemo(() => {
    const live = matches.find(isLiveMatch);
    if (live) return live.id;
    return groups[0]?.items.find((m) => m.state === "open")?.id ?? null;
  }, [matches, groups]);

  return (
    <div className="pb-28">
      {groups.map((g) => (
        <section key={g.date} className="mb-6">
          <h3 className="mb-2 px-1 text-sm font-black uppercase tracking-wide text-stone-400">
            {g.date}
          </h3>
          {/* Two columns once there's room (the page caps at max-w-3xl, where a
              third column would squeeze the cards below a readable width). */}
          <div className="grid gap-6 sm:grid-cols-2">
            {g.items.map((m) => {
              const pick = picks[m.id];
              const open = m.state === "open";
              const live = isLiveMatch(m);
              const isSaved = !dirtyIdSet.has(m.id) && savedSnapshot[m.id];
              const hero = m.id === heroId;
              const card = (
                <MatchCard
                  hero={hero}
                  data={{
                    homeCode: m.homeCode,
                    awayCode: m.awayCode,
                    homeLabel: m.homeLabel,
                    awayLabel: m.awayLabel,
                    kickoffAt: m.kickoffAt,
                    stage: m.stage,
                    groupLabel: m.groupLabel,
                    venue: m.venue,
                    trial: m.isTrial,
                    // Live games render the dual score + tappable math; the
                    // steppers lock automatically (state is no longer "open").
                    state: live ? "live" : m.state,
                    minute: live ? m.minute : undefined,
                    homeGoals: live ? m.homeGoals : undefined,
                    awayGoals: live ? m.awayGoals : undefined,
                  }}
                  opensAt={m.opensAt}
                  entry={{
                    home: pick.home,
                    away: pick.away,
                    onChange: (side, n) => setPick(m.id, side, n),
                  }}
                  onExpire={() => router.refresh()}
                  status={
                    open ? (
                      isSaved ? (
                        <span className="text-pitch dark:text-emerald-400">Saved ✓</span>
                      ) : (
                        <span className="text-stone-500 dark:text-stone-300">Unsaved</span>
                      )
                    ) : live ? (
                      <span className={LIVE_TEXT}>● Live</span>
                    ) : (
                      <span className="text-stone-500 dark:text-stone-300">🔒 Locked</span>
                    )
                  }
                />
              );
              // The hero spans both columns so the most urgent match leads.
              return hero ? (
                <div key={m.id} className="sm:col-span-2">
                  {card}
                </div>
              ) : (
                <div key={m.id}>{card}</div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 glass glass-frost px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-sm font-bold text-stone-500 dark:text-stone-300">
            {flash
              ? flash
              : dirtyIds.length
                ? `${dirtyIds.length} unsaved`
                : "All caught up"}
          </span>
          <button
            onClick={save}
            disabled={pending || dirtyIds.length === 0}
            className={`rounded-full chrome px-6 py-3 font-bold text-pitch dark:text-emerald-400 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
          >
            {pending ? "Saving…" : "Save predictions"}
          </button>
        </div>
      </div>
    </div>
  );
}
