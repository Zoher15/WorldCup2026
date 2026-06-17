"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Stepper } from "./Stepper";
import { Countdown } from "./Countdown";
import { BreakdownRow } from "./BreakdownRow";
import { Confetti } from "./Confetti";
import { CountUp } from "./CountUp";
import { LiveBadge, FullTimeBadge } from "./StatusBadge";
import { Icon } from "./Icon";
import { FOCUS_RING, LIVE_TEXT, PREDICTION_TEXT, RESULT_TEXT } from "./theme";
import { teamByCode, teamColor, teamLabel } from "@/lib/fifa";
import { formatHostCity, formatKickoffDateCompact, formatKickoffTime, formatStageLabel, shortHostCity } from "@/lib/format";
import type { PredictionState } from "@/lib/prediction-rules";
import { computeBreakdown } from "@/lib/score-breakdown";
import type { Stage } from "@/lib/types";

/**
 * Liquid-glass match card: the two teams' flags fill the whole card edge to
 * edge and butt against each other in a hard split down the middle. Floating on
 * top are frosted, translucent glass panels (see `.glass` in globals.css) — the
 * vibrant flags glow through the blur while text stays crisp, so the flags stay
 * the hero without ever fighting the copy. The *state* drives the status pill
 * and what sits in the single focal tile (score-entry steppers, a revealed
 * pick, the live/final score, or kickoff time).
 */
export type MatchCardState = "upcoming" | "open" | "locked" | "live" | "final";

export interface MatchCardData {
  homeCode: string | null;
  awayCode: string | null;
  homeLabel?: string | null; // fallback text for knockout placeholders
  awayLabel?: string | null;
  kickoffAt: string;
  stage?: Stage;
  groupLabel?: string | null;
  /** Host city / venue, shown top-right on upcoming cards. */
  venue?: string | null;
  /** India vs Italy practice match — shows a "Practice" tag instead of the stage. */
  trial?: boolean;
  state: MatchCardState;
  minute?: number | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  /** Knockout: the team that advanced (for the advance-bonus math). */
  advancedCode?: string | null;
}

/**
 * Map a derived match shape (camelCase, with `result`/`live` objects — a
 * profile row or a per-match board's match) onto the card: a locked match with
 * a result reads as "final", with an in-play score as "live", and the score
 * fields come from whichever of the two is present.
 */
export function toMatchCardData(m: {
  homeCode: string | null;
  awayCode: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  kickoffAt: string;
  stage: Stage;
  groupLabel: string | null;
  venue: string | null;
  trial?: boolean;
  state: PredictionState;
  result: { home: number; away: number; advancedCode: string | null } | null;
  live: { home: number; away: number; minute: number | null } | null;
}): MatchCardData {
  let state: MatchCardState = m.state;
  if (m.state === "locked" && m.result) state = "final";
  else if (m.state === "locked" && m.live) state = "live";
  return {
    homeCode: m.homeCode,
    awayCode: m.awayCode,
    homeLabel: m.homeLabel,
    awayLabel: m.awayLabel,
    kickoffAt: m.kickoffAt,
    stage: m.stage,
    groupLabel: m.groupLabel,
    venue: m.venue,
    trial: m.trial,
    state,
    minute: m.live?.minute,
    homeGoals: m.result?.home ?? m.live?.home,
    awayGoals: m.result?.away ?? m.live?.away,
    advancedCode: m.result?.advancedCode,
  };
}

export interface MatchCardProps {
  data: MatchCardData;
  /** Window-open time (ISO). Drives a hidden ticker that auto-refreshes an
   *  upcoming card the moment its prediction window opens (no visible badge). */
  opensAt?: string;
  /** Interactive score entry; when present on an open match, the focal tile shows steppers. */
  entry?: {
    home: number;
    away: number;
    onChange: (side: "home" | "away", n: number) => void;
  };
  /** A revealed predicted score, shown in the focal tile when not editing, and
   *  paired with the live/final score (with tap-to-see-points) once a match has
   *  kicked off. `advancePick` feeds the knockout advance-bonus math. */
  pick?: { home: number; away: number; advancePick?: string | null } | null;
  /** Whose pick this is — "your call" by default; a group-mate's profile passes
   *  "their call" so the tile never claims someone else's pick as yours. */
  pickLabel?: string;
  /** A small status chip in the header row (between the stage label and the
   *  status pill) — e.g. the predict page's Saved / Unsaved / Locked indicator. */
  status?: React.ReactNode;
  /** Contextual strip under the teams (saved indicator, points, privacy note). */
  footer?: React.ReactNode;
  /** When set, renders a "See all groups' picks →" link under the card to the
   *  cross-group match hub. Lives in the footer region so it never overlaps the
   *  score steppers or the tap-for-math tile. */
  detailHref?: string;
  /** Fired when a header countdown reaches zero (e.g. to refresh the page). */
  onExpire?: () => void;
  /** Brighten the flags on hover (as if unlocked) — used in the homepage preview. */
  revealOnHover?: boolean;
  /** The single most urgent match (first live, else next kickoff): vivid flag
   *  treatment, a touch taller, bigger score digits, and a 2px brand-gradient
   *  ring. The parent supplies any grid spanning (e.g. `sm:col-span-2`). */
  hero?: boolean;
  /** Open match the viewer hasn't picked yet: a soft pulsing green ring nudges
   *  them. Owned here so the ring hugs the card and never wraps the "Next up"
   *  flag that sits above it. */
  nag?: boolean;
}

/** Frosted liquid-glass surface for every text panel floating over the flags.
 *  Keeps the same default text tones as before; the `.glass` class supplies the
 *  translucent tint, blur, edge and sheen. */
const GLASS = "glass text-stone-100";

/** Last seen live score per match, module-level so it survives the remounts a
 *  `router.refresh` can cause — a goal still flashes whether the card
 *  re-renders in place or comes back fresh with the new score. Keyed on
 *  teams + kickoff because `MatchCardData` carries no match id. Capped so a
 *  long session browsing many pages can't grow it without bound. */
const lastLiveScores = new Map<string, string>();

/** Bumps the returned counter once each time a *live* match's score changes
 *  versus the last score this session saw for it (first sighting just records —
 *  no flash on initial load). The counter keys the focal tile so the one-shot
 *  `goal-flash` CSS animation re-fires on every goal. */
function useGoalFlash(data: MatchCardData): number {
  const [flash, setFlash] = useState(0);
  const active =
    data.state === "live" && data.homeGoals != null && data.awayGoals != null;
  const key = `${data.homeCode}-${data.awayCode}-${data.kickoffAt}`;
  const score = `${data.homeGoals}-${data.awayGoals}`;
  useEffect(() => {
    if (!active) return;
    const prev = lastLiveScores.get(key);
    if (prev === score) return;
    if (lastLiveScores.size > 200) lastLiveScores.clear();
    lastLiveScores.set(key, score);
    if (prev !== undefined) {
      setFlash((n) => n + 1);
      // A goal is the most exciting beat in football — give it a short haptic
      // (guarded; a no-op on devices/browsers without the Vibration API).
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(30);
      }
    }
  }, [active, key, score]);
  return flash;
}

function StatusPill({
  data,
  onExpire,
}: {
  data: MatchCardData;
  onExpire?: () => void;
}) {
  const base = "rounded-full px-2.5 py-0.5";
  switch (data.state) {
    case "live":
      return (
        <LiveBadge className={`${base} glass`}>
          LIVE{data.minute ? ` ${data.minute}'` : ""}
        </LiveBadge>
      );
    case "final":
      return <FullTimeBadge className={`${base} glass`}>FULL TIME</FullTimeBadge>;
    case "locked":
      return (
        <span className={`${base} ${GLASS} inline-flex items-center gap-1 text-stone-300`}>
          <Icon name="lock" /> Locked
        </span>
      );
    case "open":
      return (
        <span
          title="Closes at kickoff"
          className={`${base} glass inline-flex items-center gap-1 text-flame`}
        >
          <Icon name="clock" /> <Countdown target={data.kickoffAt} expiredLabel="closed" onExpire={onExpire} />
        </span>
      );
    case "upcoming": {
      // Top-right carries the host city. The "opens in" countdown isn't shown
      // here — it lives on the centre tile (where the steppers will appear), so
      // the same timing isn't duplicated in two places. Long metros are shown
      // compact (full name on hover) so they don't crowd the header.
      const cityFull = formatHostCity(data.venue);
      const city = cityFull ? shortHostCity(cityFull) : null;
      return (
        <span
          title={cityFull ?? undefined}
          className={`${base} ${GLASS} inline-flex items-center gap-1 text-sky-400`}
        >
          {city ? <><Icon name="map-pin" /> {city}</> : "Upcoming"}
        </span>
      );
    }
  }
}

/** A team's name on a solid bar — the flags carry identity, this keeps it legible. */
function TeamName({ code, label }: { code: string | null; label?: string | null }) {
  const name = teamLabel(code, label);
  return (
    <span
      title={name}
      className={`truncate rounded-lg px-2.5 py-1 text-center text-sm font-extrabold ${GLASS} text-stone-50`}
    >
      {name}
    </span>
  );
}

/** The single focal tile: a solid block holding the score (or kickoff time).
 *  Digits wear the display face (`font-display`, Archivo Black) — the face is
 *  inherently black, so no `font-black` (which would synthesise a faux bold).
 *  `tabular-nums` keeps the two sides on a fixed pitch so the colon never
 *  shifts as the score changes. */
function Score({
  home,
  away,
  tone,
  label,
  large,
}: {
  home: number;
  away: number;
  tone: string;
  label?: string;
  /** Hero card: oversized, stadium-scoreboard digits (text-5xl) so the score
   *  dominates the focal tile. Still fits the fixed-height focal region. */
  large?: boolean;
}) {
  return (
    <div className={`rounded-xl px-4 py-1.5 text-center ${GLASS}`}>
      <div className={`flex items-center justify-center gap-2 font-display tabular-nums ${large ? "text-5xl" : "text-3xl"} ${tone}`}>
        <span>{home}</span>
        <span className="text-stone-600">:</span>
        <span>{away}</span>
      </div>
      {label && (
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-200">{label}</div>
      )}
    </div>
  );
}

/** A compact label-over-score block — one of the two scores in the live/final tile. */
function MiniScore({
  label,
  home,
  away,
  tone,
  large,
}: {
  label: React.ReactNode;
  home: number;
  away: number;
  tone: string;
  /** Hero card: one step larger digits. */
  large?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold uppercase tracking-wide text-stone-200">
        {label}
      </div>
      <div className={`flex items-center justify-center gap-1.5 font-display tabular-nums ${large ? "text-4xl" : "text-2xl"} ${tone}`}>
        <span>{home}</span>
        <span className="text-stone-600">:</span>
        <span>{away}</span>
      </div>
    </div>
  );
}

/**
 * The live/final focal tile: the player's call beside the actual score, in the
 * same glass tile (and same footprint) the single score used — so the card keeps
 * its dimensions. Tapping it expands the points math: outcome + closeness (+ the
 * knockout advance bonus) = total. While the match is live the math is a
 * projection ("if it ends now"); at full time it's the points earned. Rendered
 * identically wherever a pick + a score are both known — your card or a friend's.
 */
function DualScore({
  pick,
  data,
  live,
  large,
  pickLabel = "your call",
}: {
  pick: { home: number; away: number; advancePick?: string | null };
  data: MatchCardData;
  live: boolean;
  /** Hero card: one step larger digits. */
  large?: boolean;
  pickLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const result = {
    home: data.homeGoals!,
    away: data.awayGoals!,
    advancedCode: data.advancedCode ?? null,
  };
  const b = computeBreakdown({
    pick,
    result,
    stage: data.stage ?? "group",
    homeCode: data.homeCode,
    awayCode: data.awayCode,
  });
  // Nailed the scoreline exactly (only celebrated once the result is final —
  // a live "exact" can still slip away).
  const exact = !live && pick.home === result.home && pick.away === result.away;
  // A heartbreak-close finish — right idea, just shy of a perfect 10. Worth a
  // gentle "so close" instead of silence (final and not exact).
  const nearMiss = !live && !exact && b.total >= 8;
  // Recap tone once it's full time: a strong call glows green, a middling one
  // reads neutral blue, a miss cools to flame — so a finished card carries the
  // celebrate/commiserate verdict at a glance.
  const pointsTone = live
    ? LIVE_TEXT
    : b.total >= 8
      ? RESULT_TEXT
      : b.total <= 3
        ? "text-flame"
        : "text-sky-400";

  return (
    <div className="flex flex-col items-stretch">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`rounded-xl px-4 py-1.5 ${GLASS} transition active:scale-95 ${FOCUS_RING}`}
      >
        <div className="flex items-center justify-center gap-3">
          <MiniScore
            label={pickLabel}
            home={pick.home}
            away={pick.away}
            tone={PREDICTION_TEXT}
            large={large}
          />
          <span className="h-7 w-px bg-stone-600/70" />
          <MiniScore
            label={live ? "live score" : "full time"}
            home={result.home}
            away={result.away}
            tone={live ? LIVE_TEXT : "text-stone-50"}
            large={large}
          />
        </div>
        <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-200">
          <span className={`font-black tabular-nums ${pointsTone}`}>
            {live ? "~" : ""}<CountUp value={b.total} /> pt{b.total === 1 ? "" : "s"}
          </span>
          {exact && (
            <span className="inline-flex items-center gap-1 font-black normal-case text-sunburst">
              <Icon name="target" /> Exact!
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            · tap for math <Icon name={open ? "chevron-up" : "chevron-down"} />
          </span>
        </div>
      </button>

      {open && (
        <div className={`mt-2 rounded-xl px-3 py-2 text-left ${GLASS}`}>
          <BreakdownRow label="Right result" value={b.outcome} max={5} />
          <BreakdownRow label="Scoreline closeness" value={b.closeness} max={5} />
          {b.knockout && (
            <BreakdownRow label="Who advances" value={b.advance} />
          )}
          <div className="mt-1 flex items-center justify-between border-stone-600/60 pt-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-stone-200">
              {live ? "If it ends now" : "Total"}
            </span>
            <span className={`text-sm font-black tabular-nums ${live ? LIVE_TEXT : RESULT_TEXT}`}>
              <CountUp value={b.total} /> pt{b.total === 1 ? "" : "s"}
            </span>
          </div>
          {nearMiss && (
            <p className="mt-1.5 text-center text-[11px] font-bold text-sunburst">
              💔 So close — {10 - b.total} off a perfect 10
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One half of the card's background, painted edge to edge with a team's actual
 * flag (the flag-icons `fi fi-xx` class). The two halves butt together in a hard
 * split at the exact middle; unknown teams (knockout placeholders) fall back to
 * their neutral colour.
 *
 * Positioning and size are inline because flag-icons' `.fi` rule sets
 * `position: relative; width: 1.333em` at equal specificity and loads later —
 * inline styles are the only thing that reliably wins.
 */
function FlagHalf({ code, side }: { code: string | null; side: "left" | "right" }) {
  const team = teamByCode(code);
  const style: React.CSSProperties = {
    position: "absolute",
    top: 0,
    height: "100%",
    backgroundSize: "cover",
    // The left half runs 1px past centre so the hard seam never shows a hairline.
    ...(side === "left"
      ? { left: 0, width: "calc(50% + 1px)" }
      : { left: "50%", width: "50%" }),
    ...(team ? null : { backgroundColor: teamColor(code) }),
  };
  return (
    <span
      aria-hidden
      className={`bg-center bg-no-repeat ${team ? `fi fi-${team.iso}` : ""}`}
      style={style}
    />
  );
}

export function MatchCard({ data, opensAt, entry, pick, pickLabel, status, footer, detailHref, onExpire, revealOnHover, hero, nag }: MatchCardProps) {
  const editing = data.state === "open" && entry != null;
  const hasResult =
    (data.state === "live" || data.state === "final") &&
    data.homeGoals != null &&
    data.awayGoals != null;
  // The player's own scoreline, whether it arrives as a revealed `pick` (profiles)
  // or via the `entry` they saved (the predict page). Drives the live/final tile.
  const myPick = pick ?? (entry ? { home: entry.home, away: entry.away } : null);

  // Goal! Counts up whenever this live match's score moves during the session.
  const goalFlash = useGoalFlash(data);
  // Called the scoreline on the nose at full time: one celebratory confetti
  // burst over the card (the 🎯 badge in the tile carries the static credit).
  const exactCall =
    data.state === "final" &&
    hasResult &&
    myPick != null &&
    myPick.home === data.homeGoals &&
    myPick.away === data.awayGoals;

  // The single focal tile, always the same size so the card's proportions never
  // shift between states. Where a score can be entered (`entry`), the steppers
  // are the constant element — active while editing, and disabled with a lock
  // once the window is shut. Otherwise it shows the result, a revealed pick, or
  // the kickoff time.
  let focal: React.ReactNode;
  if (hasResult && myPick) {
    // Kicked off and we know the player's call: show both scores side by side in
    // the same tile, tappable for the points math (provisional while live).
    focal = (
      <DualScore
        pick={myPick}
        data={data}
        live={data.state === "live"}
        large={hero}
        pickLabel={pickLabel}
      />
    );
  } else if (hasResult) {
    // A score but no known pick (e.g. they didn't predict): just the scoreline.
    focal = (
      <Score
        home={data.homeGoals!}
        away={data.awayGoals!}
        tone={data.state === "live" ? LIVE_TEXT : "text-stone-50"}
        large={hero}
      />
    );
  } else if (entry && editing) {
    // Open for editing: active steppers are the control (thumb-size on the
    // hero). Half-width cards trade the breathing room between the steppers
    // for the bigger buttons, so the row still fits a two-column grid.
    focal = (
      <div className={`rounded-xl ${hero ? "px-3" : "px-2"} py-1.5 ${GLASS}`}>
        <div className={`flex items-center justify-center ${hero ? "gap-3" : "gap-2"}`}>
          <Stepper size={hero ? "md" : "sm"} value={entry.home} onChange={(n) => entry.onChange("home", n)} />
          <span className="text-xl font-black text-stone-600">:</span>
          <Stepper size={hero ? "md" : "sm"} value={entry.away} onChange={(n) => entry.onChange("away", n)} />
        </div>
        <div className="text-center text-[10px] font-bold uppercase tracking-wide text-stone-200">
          your call
        </div>
      </div>
    );
  } else if (entry && data.state === "locked") {
    // Window shut at kickoff: drop the +/- and show the locked-in pick.
    focal = (
      <div className={`rounded-xl px-4 py-1.5 ${GLASS}`}>
        <div className="flex items-center justify-center gap-2 text-2xl font-black tabular-nums text-stone-300">
          <Icon name="lock" className="text-xl leading-none" />
          <span>{entry.home}</span>
          <span className="text-stone-600">:</span>
          <span>{entry.away}</span>
        </div>
        <div className="text-center text-[10px] font-bold uppercase tracking-wide text-stone-200">
          locked
        </div>
      </div>
    );
  } else if (entry && data.state === "upcoming" && opensAt) {
    // Not open yet: the centre tile (where the steppers will land) counts down
    // to when play opens, and refreshes the card the moment it does — the one
    // place this timing lives, with the host city already shown top-right.
    focal = (
      <div className={`rounded-xl px-4 py-2 text-center ${GLASS}`}>
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-200">opens in</div>
        <div className="text-xl font-black tabular-nums text-sky-400">
          <Countdown target={opensAt} expiredLabel="open now" onExpire={onExpire} />
        </div>
      </div>
    );
  } else if (pick) {
    focal = (
      <Score
        home={pick.home}
        away={pick.away}
        tone={PREDICTION_TEXT}
        label={pickLabel ?? "your pick"}
        large={hero}
      />
    );
  } else {
    focal = (
      <div className={`rounded-xl px-4 py-2 text-center ${GLASS}`}>
        <div className="text-lg font-black leading-tight text-stone-100">
          {formatKickoffDateCompact(data.kickoffAt)}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-200">
          {formatKickoffTime(data.kickoffAt)} · kickoff
        </div>
      </div>
    );
  }

  // The header pill truncates on narrow cards, so it carries its full text as a
  // hover title too. A practice (trial) match wears a target icon before the
  // word; the title stays plain text since `title` can't hold an icon.
  const stageLabel = data.trial
    ? "Practice"
    : formatStageLabel(data.groupLabel, data.stage);

  // The hero is the next match to act on. Flag it with a chip *above* the card
  // (not in the header) so it never crowds the centred save status. Live heroes
  // already shout via the flame ring, so the flag is for open/upcoming only.
  const showNextUp = hero && (data.state === "open" || data.state === "upcoming");

  const card = (
    <div className={`relative animate-pop-in overflow-hidden rounded-2xl bg-stone-800 shadow-lg ring-1 ring-white/15${revealOnHover ? " glass-reveal" : ""}`}>
      {/* The two flags fill the card and butt together at a hard centre split.
          A 1px bleed past the edges keeps the rounded clip from leaving a hairline. */}
      <div aria-hidden className="pointer-events-none absolute -inset-px">
        <FlagHalf code={data.homeCode} side="left" />
        <FlagHalf code={data.awayCode} side="right" />
      </div>
      {/* Frost the flags into a glass surface: the colours bloom through the
          blur so the whole card reads as one liquid-glass panel (and the
          pointer sheen rides across it). A live match carries the flame-cast
          frost; an open (playable) match — and the hero card — wear the vivid
          variant (thinner frost, brighter flags, a green cast) so they stand
          out from the still-frosted upcoming cards. */}
      <div
        aria-hidden
        className={`glass glass-flag absolute inset-0 rounded-2xl ${
          data.state === "live"
            ? "glass-live"
            : data.state === "open" || hero
              ? "glass-vivid"
              : data.state === "locked"
                ? "glass-muted"
                : ""
        }`}
      />

      <div className={`relative flex ${hero ? "min-h-[10.5rem]" : "min-h-[9rem]"} flex-col justify-between gap-2 p-3 text-xs font-bold`}>
        {/* Header: stage on the left, the status pill on the right, and the save
            status absolutely centered so it sits dead-centre of the card —
            matching "Locked". The hero's "Next up" flag lives above the card
            (outside it), so nothing competes with the centred status. */}
        <div className="relative flex items-center justify-between gap-2">
          <span
            title={stageLabel}
            className={`inline-flex min-w-0 items-center gap-1 truncate rounded-full px-2.5 py-0.5 ${GLASS} text-stone-200`}
          >
            {data.trial && <Icon name="target" />}
            {stageLabel}
          </span>
          {status && (
            <span
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-0.5 ${GLASS}`}
            >
              {status}
            </span>
          )}
          <StatusPill data={data} onExpire={onExpire} />
        </div>

        {/* Fixed-height focal region so the card never changes length as its
            centre swaps between the (taller) two-line steppers and a one-line
            score/time — every state centres within the same space. The inner
            wrapper is keyed on the goal counter so a score change remounts it
            and the one-shot `goal-flash` wash + pop re-fires; the wash sits
            behind the translucent tile, glowing through the frost. */}
        <div className="flex min-h-[4.25rem] items-center justify-center">
          <div key={goalFlash} className={goalFlash > 0 ? "goal-flash rounded-xl" : undefined}>
            {/* On a confirmed live goal the digits get a sharp scale "punch"
                (inner element, so it never fights the wrapper's wash scale). */}
            <div className={goalFlash > 0 ? "goal-punch" : undefined}>{focal}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <TeamName code={data.homeCode} label={data.homeLabel} />
            <TeamName code={data.awayCode} label={data.awayLabel} />
          </div>
          {footer && (
            <div className={`rounded-lg px-3 py-1.5 ${GLASS} text-stone-100`}>
              {footer}
            </div>
          )}
          {detailHref && (
            <Link
              href={detailHref}
              prefetch={false}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 ${GLASS} text-violet-300 transition active:scale-[0.98]`}
            >
              See all groups&apos; picks
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>

      {/* Exact-score celebration: a single confetti burst floats over the whole
          card on mount. Decorative and pointer-transparent, so the tap-for-math
          tile underneath stays fully usable. */}
      {exactCall && <Confetti />}
    </div>
  );

  // Card chrome. A live match radiates a soft, slowly-rotating brand-wave GLOW
  // (no hard rim — a blurred conic colour wheel blooming around the card, see
  // .live-ring); the hero ("Next up") wears the same brand gradient as a crisp
  // static 5px ring (a padded wrapper, since `border-image` can't follow rounded
  // corners — outer radius = card's 16px + 5px pad). Both are the one brand wave —
  // live glows it, hero holds it still — and live takes precedence as the cue.
  let framed: React.ReactNode;
  if (data.state === "live") {
    framed = <div className="live-ring">{card}</div>;
  } else if (hero) {
    framed = <div className="gradient-accent rounded-[21px] p-[5px]">{card}</div>;
  } else {
    framed = card;
  }

  // The "no pick yet" nag ring hugs whatever frame the card has, matching its
  // radius so it stays concentric with the card (or the hero's gradient ring).
  // The live glow has no rim, so a live card's nag ring sits at the card radius.
  if (nag) {
    const radius = hero ? "rounded-[21px]" : "rounded-2xl";
    framed = <div className={`nag-pulse ${radius}`}>{framed}</div>;
  }

  // The hero's "Next up" flag rides above the card — outside it — so it never
  // crowds the centred save status in the header.
  if (showNextUp) {
    return (
      <div className="flex flex-col">
        <div className="mb-1.5 flex justify-center">
          <span className="rounded-full glass px-3 py-0.5 text-xs font-black text-sky-400">
            ⚡ Next up
          </span>
        </div>
        {framed}
      </div>
    );
  }
  return framed;
}
