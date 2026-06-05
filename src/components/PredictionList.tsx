"use client";

import { useMemo, useState, useTransition } from "react";
import { Flag } from "./Flag";
import { Stepper } from "./Stepper";
import { teamByCode } from "@/lib/fifa";
import { savePredictionsAction } from "@/app/predict/actions";
import type { MatchForPrediction, SavedPrediction } from "@/lib/predictions";

type Picks = Record<string, { home: number; away: number }>;

function teamName(code: string | null, label: string | null): string {
  return teamByCode(code)?.name ?? label ?? "To be decided";
}

function dateHeading(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function PredictionList({
  matches,
  initial,
}: {
  matches: MatchForPrediction[];
  initial: Record<string, SavedPrediction>;
}) {
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
    for (const m of matches) {
      const saved = initial[m.id];
      if (saved) p[m.id] = { home: saved.predHome, away: saved.predAway };
    }
    return p;
  });
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const dirtyIds = useMemo(
    () =>
      matches
        .filter((m) => {
          const cur = picks[m.id];
          const snap = savedSnapshot[m.id];
          return !snap || snap.home !== cur.home || snap.away !== cur.away;
        })
        .map((m) => m.id),
    [matches, picks, savedSnapshot],
  );

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
        `Saved ${res.saved}${res.skipped ? ` · ${res.skipped} locked/skipped` : ""} ✓`,
      );
    });
  }

  // Group matches under date headings.
  const groups: { date: string; items: MatchForPrediction[] }[] = [];
  for (const m of matches) {
    const date = dateHeading(m.kickoffAt);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(m);
    else groups.push({ date, items: [m] });
  }

  return (
    <div className="pb-28">
      {groups.map((g) => (
        <section key={g.date} className="mb-6">
          <h3 className="mb-2 px-1 text-sm font-black uppercase tracking-wide text-stone-400">
            {g.date}
          </h3>
          <div className="space-y-3">
            {g.items.map((m) => {
              const pick = picks[m.id];
              const isSaved = !dirtyIds.includes(m.id) && savedSnapshot[m.id];
              return (
                <div
                  key={m.id}
                  className="rounded-2xl bg-white/85 p-4 shadow ring-1 ring-black/5"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-400">
                      {m.groupLabel ? `Group ${m.groupLabel}` : m.stage.replace(/_/g, " ")}
                      {" · "}
                      {new Date(m.kickoffAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {isSaved && (
                      <span className="text-xs font-bold text-pitch">Saved ✓</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Flag code={m.homeCode} size="md" />
                      <span className="truncate font-bold">
                        {teamName(m.homeCode, m.homeLabel)}
                      </span>
                    </div>
                    <Stepper
                      value={pick.home}
                      onChange={(n) => setPick(m.id, "home", n)}
                    />
                    <span className="font-black text-stone-300">:</span>
                    <Stepper
                      value={pick.away}
                      onChange={(n) => setPick(m.id, "away", n)}
                    />
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                      <span className="truncate text-right font-bold">
                        {teamName(m.awayCode, m.awayLabel)}
                      </span>
                      <Flag code={m.awayCode} size="md" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-black/5 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-sm font-bold text-stone-500">
            {flash
              ? flash
              : dirtyIds.length
                ? `${dirtyIds.length} unsaved`
                : "All predictions saved"}
          </span>
          <button
            onClick={save}
            disabled={pending || dirtyIds.length === 0}
            className="rounded-full bg-pitch px-6 py-3 font-bold text-white shadow transition active:scale-95 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save predictions"}
          </button>
        </div>
      </div>
    </div>
  );
}
