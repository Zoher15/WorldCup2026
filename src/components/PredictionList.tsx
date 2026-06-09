"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MatchCard } from "./MatchCard";
import { formatKickoffDate } from "@/lib/format";
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
  const groups = useMemo(() => {
    const out: { date: string; items: MatchForPrediction[] }[] = [];
    for (const m of matches) {
      const date = formatKickoffDate(m.kickoffAt);
      const last = out[out.length - 1];
      if (last && last.date === date) last.items.push(m);
      else out.push({ date, items: [m] });
    }
    return out;
  }, [matches]);

  return (
    <div className="pb-28">
      {groups.map((g) => (
        <section key={g.date} className="mb-6">
          <h3 className="mb-2 px-1 text-sm font-black uppercase tracking-wide text-stone-400">
            {g.date}
          </h3>
          <div className="space-y-6">
            {g.items.map((m) => {
              const pick = picks[m.id];
              const open = m.state === "open";
              const isSaved = !dirtyIdSet.has(m.id) && savedSnapshot[m.id];
              return (
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
                    trial: m.isTrial,
                    state: m.state,
                  }}
                  opensAt={m.opensAt}
                  entry={{
                    home: pick.home,
                    away: pick.away,
                    onChange: (side, n) => setPick(m.id, side, n),
                  }}
                  onExpire={() => router.refresh()}
                  footer={
                    open ? (
                      isSaved ? (
                        <span className="text-pitch dark:text-emerald-400">Saved ✓</span>
                      ) : (
                        <span className="text-stone-400 dark:text-stone-400">Unsaved</span>
                      )
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      ))}

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 glass px-4 py-3">
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
            className="rounded-full glass px-6 py-3 font-bold text-pitch dark:text-emerald-400 transition active:scale-95 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save predictions"}
          </button>
        </div>
      </div>
    </div>
  );
}
