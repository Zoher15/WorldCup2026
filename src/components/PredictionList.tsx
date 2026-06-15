"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Countdown } from "./Countdown";
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
  embedded = false,
}: {
  matches: MatchForPrediction[];
  initial: Record<string, SavedPrediction>;
  /** Rendered inside another page (the home surface) rather than standalone.
   *  Stacks cards one-per-row (a two-up grid in a narrow column would squeeze
   *  them below the predict page's reference width) and drops the bottom padding
   *  that clears the fixed save bar — the host page owns that spacing, since the
   *  list isn't the last thing on it. */
  embedded?: boolean;
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
  // Save feedback carries its kind so the bar can colour success vs failure.
  const [flash, setFlash] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const openIds = useMemo(
    () => new Set(matches.filter((m) => m.state === "open").map((m) => m.id)),
    [matches],
  );

  // Tick the in-play score forward while any listed match is live.
  useLiveRefresh(matches.some(isLiveMatch));

  // Urgency banner: how many open matches lock at the very next kickoff, and
  // when. Matches arrive kickoff-ordered, so the first open one locks soonest;
  // simultaneous kickoffs (a shared lock moment) are counted together.
  const nextLock = useMemo(() => {
    const open = matches.filter((m) => m.state === "open");
    if (open.length === 0) return null;
    const target = open[0].kickoffAt;
    return { target, count: open.filter((m) => m.kickoffAt === target).length };
  }, [matches]);

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
        setFlash({ kind: "error", text: res.error ?? "Save failed." });
        return;
      }
      setSavedSnapshot((snap) => {
        const next = { ...snap };
        for (const id of dirtyIds) next[id] = { ...picks[id] };
        return next;
      });
      setFlash({
        kind: "ok",
        text: `Saved ${res.saved}${res.skipped ? ` · ${res.skipped} skipped` : ""} ✓`,
      });
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
    // pb-28 clears the fixed save bar on the standalone page; when embedded the
    // host page reserves that space below its own last section instead.
    <div className={embedded ? undefined : "pb-28"}>
      {/* Urgency hero: the next lock moment, ticking down. Refreshing on expiry
          re-derives match states so the banner (and the locked cards) update. */}
      {nextLock && (
        <div className="mb-6 flex items-center justify-center gap-2 rounded-2xl glass px-4 py-3 text-sm font-bold text-stone-700 ring-1 ring-flame/30 dark:text-stone-100">
          <span className="animate-pulse" aria-hidden>
            ⏳
          </span>
          <span>
            {nextLock.count} match{nextLock.count === 1 ? "" : "es"} lock
            {nextLock.count === 1 ? "s" : ""} in
          </span>
          <span className="font-display text-flame">
            <Countdown
              target={nextLock.target}
              onExpire={() => router.refresh()}
            />
          </span>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.date} className="mb-6">
          <h3 className="mb-2 px-1 text-sm font-black uppercase tracking-wide text-stone-400">
            {g.date}
          </h3>
          {/* grid-cols-1 (not a bare grid) so the single-column track stays
              clamped to the container: a bare grid's implicit auto column grows
              to the widest card's min-content (the hero's steppers + Next-up /
              countdown header), pushing the card past the right gutter on narrow
              phones. minmax(0,1fr) pins it; over-wide content clips in-card.
              Two-up only from md: the score-entry steppers are a fixed ~292px
              row, so a half-width card needs ~340px+ to hold them. At sm (640px)
              the standalone page's two columns are ~290px each and the steppers
              squash — md keeps it single-column until the cards have the room. */}
          <div className={`grid grid-cols-1 gap-6${embedded ? "" : " md:grid-cols-2"}`}>
            {g.items.map((m) => {
              const pick = picks[m.id];
              const open = m.state === "open";
              const live = isLiveMatch(m);
              const isSaved = !dirtyIdSet.has(m.id) && savedSnapshot[m.id];
              const hero = m.id === heroId;
              // Gentle nag: an open match with no saved pick where the steppers
              // still sit at their 0–0 default (no draft in progress either).
              const nag =
                open &&
                !savedSnapshot[m.id] &&
                pick.home === 0 &&
                pick.away === 0;
              const card = (
                <MatchCard
                  hero={hero}
                  nag={nag}
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
                  detailHref={`/m/${m.id}`}
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
              // On the standalone two-up grid the hero spans both columns so the
              // most urgent match leads. Embedded the grid is single-column, so
              // spanning two would conjure an implicit second (auto-sized) column
              // that the sibling cards then flow into — squashed two-up. Skip the
              // span there. The nag ring and "Next up" flag are owned by MatchCard
              // now, so the wrapper just handles grid spanning.
              return (
                <div
                  key={m.id}
                  className={hero && !embedded ? "md:col-span-2" : undefined}
                >
                  {card}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 glass glass-frost px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          {flash ? (
            <span
              className={`text-sm font-bold ${
                flash.kind === "ok"
                  ? "text-pitch dark:text-emerald-400"
                  : "text-flame"
              }`}
            >
              {flash.text}
            </span>
          ) : (
            <span className="text-sm font-bold text-stone-500 dark:text-stone-300">
              {dirtyIds.length
                ? `${dirtyIds.length} unsaved`
                : "All caught up"}
            </span>
          )}
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
