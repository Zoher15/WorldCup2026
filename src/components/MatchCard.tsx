"use client";

import { Stepper } from "./Stepper";
import { Countdown } from "./Countdown";
import { teamByCode, teamColor, teamLabel } from "@/lib/fifa";
import { formatHostCity, formatKickoffDateCompact, formatKickoffTime, formatStageLabel } from "@/lib/format";
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
  /** A revealed predicted score, shown in the focal tile when not editing or live/final. */
  pick?: { home: number; away: number } | null;
  /** A small status chip in the header row (between the stage label and the
   *  status pill) — e.g. the predict page's Saved / Unsaved / Locked indicator. */
  status?: React.ReactNode;
  /** Contextual strip under the teams (saved indicator, points, privacy note). */
  footer?: React.ReactNode;
  /** Fired when a header countdown reaches zero (e.g. to refresh the page). */
  onExpire?: () => void;
  /** Brighten the flags on hover (as if unlocked) — used in the homepage preview. */
  revealOnHover?: boolean;
}

/** Frosted liquid-glass surface for every text panel floating over the flags.
 *  Keeps the same default text tones as before; the `.glass` class supplies the
 *  translucent tint, blur, edge and sheen. */
const GLASS = "glass text-stone-700 dark:text-stone-100";

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
        <span className={`${base} glass inline-flex items-center gap-1.5 text-flame`}>
          <span className="live-dot h-2 w-2 rounded-full bg-flame" />
          LIVE{data.minute ? ` ${data.minute}'` : ""}
        </span>
      );
    case "final":
      return <span className={`${base} glass text-pitch dark:text-emerald-400`}>FULL TIME</span>;
    case "locked":
      return <span className={`${base} ${GLASS} text-stone-500 dark:text-stone-300`}>🔒 Locked</span>;
    case "open":
      return (
        <span className={`${base} glass inline-flex items-center gap-1 text-flame`}>
          ⏳ closes in{" "}
          <Countdown target={data.kickoffAt} expiredLabel="closed" onExpire={onExpire} />
        </span>
      );
    case "upcoming": {
      // Top-right carries the host city. The "opens in" countdown isn't shown
      // here — it lives on the centre tile (where the steppers will appear), so
      // the same timing isn't duplicated in two places.
      const city = formatHostCity(data.venue);
      return (
        <span className={`${base} ${GLASS} inline-flex items-center gap-1 text-ocean dark:text-sky-400`}>
          {city ? <>📍 {city}</> : "Upcoming"}
        </span>
      );
    }
  }
}

/** A team's name on a solid bar — the flags carry identity, this keeps it legible. */
function TeamName({ code, label }: { code: string | null; label?: string | null }) {
  return (
    <span
      className={`truncate rounded-lg px-2.5 py-1 text-center text-sm font-extrabold ${GLASS} text-stone-800 dark:text-stone-50`}
    >
      {teamLabel(code, label)}
    </span>
  );
}

/** The single focal tile: a solid block holding the score (or kickoff time). */
function Score({
  home,
  away,
  tone,
  label,
}: {
  home: number;
  away: number;
  tone: string;
  label?: string;
}) {
  return (
    <div className={`rounded-xl px-4 py-1.5 text-center ${GLASS}`}>
      <div className={`flex items-center justify-center gap-2 text-3xl font-black tabular-nums ${tone}`}>
        <span>{home}</span>
        <span className="text-stone-300 dark:text-stone-600">:</span>
        <span>{away}</span>
      </div>
      {label && (
        <div className="text-[9px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">{label}</div>
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

export function MatchCard({ data, opensAt, entry, pick, status, footer, onExpire, revealOnHover }: MatchCardProps) {
  const editing = data.state === "open" && entry != null;
  const hasResult =
    (data.state === "live" || data.state === "final") &&
    data.homeGoals != null &&
    data.awayGoals != null;

  // The single focal tile, always the same size so the card's proportions never
  // shift between states. Where a score can be entered (`entry`), the steppers
  // are the constant element — active while editing, and disabled with a lock
  // once the window is shut. Otherwise it shows the result, a revealed pick, or
  // the kickoff time.
  let focal: React.ReactNode;
  if (hasResult) {
    focal = (
      <Score
        home={data.homeGoals!}
        away={data.awayGoals!}
        tone={data.state === "live" ? "text-flame" : "text-stone-800 dark:text-stone-50"}
      />
    );
  } else if (entry && editing) {
    // Open for editing: active steppers are the control.
    focal = (
      <div className={`rounded-xl px-3 py-1.5 ${GLASS}`}>
        <div className="flex items-center justify-center gap-3">
          <Stepper size="sm" value={entry.home} onChange={(n) => entry.onChange("home", n)} />
          <span className="text-xl font-black text-stone-300 dark:text-stone-600">:</span>
          <Stepper size="sm" value={entry.away} onChange={(n) => entry.onChange("away", n)} />
        </div>
        <div className="text-center text-[9px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">
          your call
        </div>
      </div>
    );
  } else if (entry && data.state === "locked") {
    // Window shut at kickoff: drop the +/- and show the locked-in pick.
    focal = (
      <div className={`rounded-xl px-4 py-1.5 ${GLASS}`}>
        <div className="flex items-center justify-center gap-2 text-2xl font-black tabular-nums text-stone-400 dark:text-stone-400">
          <span className="text-xl leading-none">🔒</span>
          <span>{entry.home}</span>
          <span className="text-stone-300 dark:text-stone-600">:</span>
          <span>{entry.away}</span>
        </div>
        <div className="text-center text-[9px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">
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
        <div className="text-xl font-black tabular-nums text-ocean dark:text-sky-400">
          <Countdown target={opensAt} expiredLabel="open now" onExpire={onExpire} />
        </div>
        <div className="text-[9px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">opens in</div>
      </div>
    );
  } else if (pick) {
    focal = <Score home={pick.home} away={pick.away} tone="text-grape dark:text-violet-300" label="your pick" />;
  } else {
    focal = (
      <div className={`rounded-xl px-4 py-2 text-center ${GLASS}`}>
        <div className="text-lg font-black leading-tight text-stone-700 dark:text-stone-100">
          {formatKickoffDateCompact(data.kickoffAt)}
        </div>
        <div className="text-[9px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">
          {formatKickoffTime(data.kickoffAt)} · kickoff
        </div>
      </div>
    );
  }

  return (
    <div className={`relative animate-pop-in overflow-hidden rounded-2xl bg-stone-200 shadow-lg ring-1 ring-white/30 dark:bg-stone-800 dark:ring-white/15${revealOnHover ? " glass-reveal" : ""}`}>
      {/* The two flags fill the card and butt together at a hard centre split.
          A 1px bleed past the edges keeps the rounded clip from leaving a hairline. */}
      <div aria-hidden className="pointer-events-none absolute -inset-px">
        <FlagHalf code={data.homeCode} side="left" />
        <FlagHalf code={data.awayCode} side="right" />
      </div>
      {/* Frost the flags into a glass surface: the colours bloom through the
          blur so the whole card reads as one liquid-glass panel (and the
          pointer sheen rides across it). An open (playable) match wears the
          vivid variant — thinner frost, brighter flags — so it stands out
          from the still-frosted upcoming cards. */}
      <div
        aria-hidden
        className={`glass glass-flag absolute inset-0 rounded-2xl ${
          data.state === "open"
            ? "glass-vivid"
            : data.state === "locked"
              ? "glass-muted"
              : ""
        }`}
      />

      <div className="relative flex min-h-[9rem] flex-col justify-between gap-2 p-3 text-xs font-bold">
        <div className="flex items-center justify-between gap-2">
          <span className={`min-w-0 truncate rounded-full px-2.5 py-0.5 ${GLASS} text-stone-600 dark:text-stone-200`}>
            {data.trial
              ? "🎯 Practice"
              : formatStageLabel(data.groupLabel, data.stage)}
          </span>
          {status && (
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 ${GLASS}`}>
              {status}
            </span>
          )}
          <StatusPill data={data} onExpire={onExpire} />
        </div>

        <div className="flex justify-center">{focal}</div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <TeamName code={data.homeCode} label={data.homeLabel} />
            <TeamName code={data.awayCode} label={data.awayLabel} />
          </div>
          {footer && (
            <div className={`rounded-lg px-3 py-1.5 ${GLASS} text-stone-700 dark:text-stone-100`}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
