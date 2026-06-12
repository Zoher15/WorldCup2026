"use client";

import { useState } from "react";
import { Stepper } from "./Stepper";
import { Countdown } from "./Countdown";
import { BreakdownRow } from "./BreakdownRow";
import { LiveBadge, FullTimeBadge } from "./StatusBadge";
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
        <LiveBadge className={`${base} glass`}>
          LIVE{data.minute ? ` ${data.minute}'` : ""}
        </LiveBadge>
      );
    case "final":
      return <FullTimeBadge className={`${base} glass`}>FULL TIME</FullTimeBadge>;
    case "locked":
      return <span className={`${base} ${GLASS} text-stone-500 dark:text-stone-300`}>🔒 Locked</span>;
    case "open":
      return (
        <span
          title="Closes at kickoff"
          className={`${base} glass inline-flex items-center gap-1 text-flame`}
        >
          ⏳ <Countdown target={data.kickoffAt} expiredLabel="closed" onExpire={onExpire} />
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
          className={`${base} ${GLASS} inline-flex items-center gap-1 text-ocean dark:text-sky-400`}
        >
          {city ? <>📍 {city}</> : "Upcoming"}
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
      className={`truncate rounded-lg px-2.5 py-1 text-center text-sm font-extrabold ${GLASS} text-stone-800 dark:text-stone-50`}
    >
      {name}
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
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">{label}</div>
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
}: {
  label: React.ReactNode;
  home: number;
  away: number;
  tone: string;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">
        {label}
      </div>
      <div className={`flex items-center justify-center gap-1.5 text-2xl font-black tabular-nums ${tone}`}>
        <span>{home}</span>
        <span className="text-stone-300 dark:text-stone-600">:</span>
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
}: {
  pick: { home: number; away: number; advancePick?: string | null };
  data: MatchCardData;
  live: boolean;
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
            label="your call"
            home={pick.home}
            away={pick.away}
            tone={PREDICTION_TEXT}
          />
          <span className="h-7 w-px bg-stone-300/70 dark:bg-stone-600/70" />
          <MiniScore
            label={live ? "live score" : "full time"}
            home={result.home}
            away={result.away}
            tone={live ? LIVE_TEXT : "text-stone-800 dark:text-stone-50"}
          />
        </div>
        <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">
          <span className={`font-black ${live ? LIVE_TEXT : RESULT_TEXT}`}>
            {live ? "~" : ""}{b.total} pt{b.total === 1 ? "" : "s"}
          </span>
          <span>· tap for math {open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className={`mt-2 rounded-xl px-3 py-2 text-left ${GLASS}`}>
          <BreakdownRow label="Right result" value={b.outcome} max={5} />
          <BreakdownRow label="Scoreline closeness" value={b.closeness} max={5} />
          {b.knockout && (
            <BreakdownRow label="Who advances" value={b.advance} />
          )}
          <div className="mt-1 flex items-center justify-between border-t border-stone-300/60 pt-1 dark:border-stone-600/60">
            <span className="text-[11px] font-black uppercase tracking-wide text-stone-500 dark:text-stone-200">
              {live ? "If it ends now" : "Total"}
            </span>
            <span className={`text-sm font-black ${live ? LIVE_TEXT : RESULT_TEXT}`}>
              {b.total} pt{b.total === 1 ? "" : "s"}
            </span>
          </div>
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

export function MatchCard({ data, opensAt, entry, pick, status, footer, onExpire, revealOnHover }: MatchCardProps) {
  const editing = data.state === "open" && entry != null;
  const hasResult =
    (data.state === "live" || data.state === "final") &&
    data.homeGoals != null &&
    data.awayGoals != null;
  // The player's own scoreline, whether it arrives as a revealed `pick` (profiles)
  // or via the `entry` they saved (the predict page). Drives the live/final tile.
  const myPick = pick ?? (entry ? { home: entry.home, away: entry.away } : null);

  // The single focal tile, always the same size so the card's proportions never
  // shift between states. Where a score can be entered (`entry`), the steppers
  // are the constant element — active while editing, and disabled with a lock
  // once the window is shut. Otherwise it shows the result, a revealed pick, or
  // the kickoff time.
  let focal: React.ReactNode;
  if (hasResult && myPick) {
    // Kicked off and we know the player's call: show both scores side by side in
    // the same tile, tappable for the points math (provisional while live).
    focal = <DualScore pick={myPick} data={data} live={data.state === "live"} />;
  } else if (hasResult) {
    // A score but no known pick (e.g. they didn't predict): just the scoreline.
    focal = (
      <Score
        home={data.homeGoals!}
        away={data.awayGoals!}
        tone={data.state === "live" ? LIVE_TEXT : "text-stone-800 dark:text-stone-50"}
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
        <div className="text-center text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">
          your call
        </div>
      </div>
    );
  } else if (entry && data.state === "locked") {
    // Window shut at kickoff: drop the +/- and show the locked-in pick.
    focal = (
      <div className={`rounded-xl px-4 py-1.5 ${GLASS}`}>
        <div className="flex items-center justify-center gap-2 text-2xl font-black tabular-nums text-stone-400 dark:text-stone-300">
          <span className="text-xl leading-none">🔒</span>
          <span>{entry.home}</span>
          <span className="text-stone-300 dark:text-stone-600">:</span>
          <span>{entry.away}</span>
        </div>
        <div className="text-center text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">
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
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">opens in</div>
        <div className="text-xl font-black tabular-nums text-ocean dark:text-sky-400">
          <Countdown target={opensAt} expiredLabel="open now" onExpire={onExpire} />
        </div>
      </div>
    );
  } else if (pick) {
    focal = <Score home={pick.home} away={pick.away} tone={PREDICTION_TEXT} label="your pick" />;
  } else {
    focal = (
      <div className={`rounded-xl px-4 py-2 text-center ${GLASS}`}>
        <div className="text-lg font-black leading-tight text-stone-700 dark:text-stone-100">
          {formatKickoffDateCompact(data.kickoffAt)}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-200">
          {formatKickoffTime(data.kickoffAt)} · kickoff
        </div>
      </div>
    );
  }

  // The header pill truncates on narrow cards, so it carries its full text as a
  // hover title too.
  const stageLabel = data.trial
    ? "🎯 Practice"
    : formatStageLabel(data.groupLabel, data.stage);

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
        <div className="relative flex items-center justify-between gap-2">
          <span
            title={stageLabel}
            className={`min-w-0 truncate rounded-full px-2.5 py-0.5 ${GLASS} text-stone-600 dark:text-stone-200`}
          >
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
            score/time — every state centres within the same space. */}
        <div className="flex min-h-[4.25rem] items-center justify-center">{focal}</div>

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
