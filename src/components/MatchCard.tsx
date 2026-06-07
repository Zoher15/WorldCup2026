"use client";

import { Stepper } from "./Stepper";
import { Countdown } from "./Countdown";
import { teamByCode, teamColor, teamLabel } from "@/lib/fifa";
import { formatKickoffTime, formatStageLabel } from "@/lib/format";
import type { Stage } from "@/lib/types";

/**
 * Every place a match shows up — predicting, locked, live, finished — speaks
 * one visual language: the two teams' flags fill the whole card, meeting in a
 * feathered seam down the middle, with the essentials floating on top in legible
 * glass chips. The *state* drives the status pill and what lives in the center
 * (score-entry steppers, a revealed pick, the live/final score, or kickoff time).
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
  state: MatchCardState;
  minute?: number | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

export interface MatchCardProps {
  data: MatchCardData;
  /** Window-open time (ISO) for the "opens in" countdown on upcoming matches. */
  opensAt?: string;
  /** Interactive score entry; when present on an open match, the center shows steppers. */
  entry?: {
    home: number;
    away: number;
    onChange: (side: "home" | "away", n: number) => void;
  };
  /** A revealed predicted score, shown in the center when not editing or live/final. */
  pick?: { home: number; away: number } | null;
  /** Contextual strip under the teams (saved indicator, points, privacy note). */
  footer?: React.ReactNode;
  /** Fired when a header countdown reaches zero (e.g. to refresh the page). */
  onExpire?: () => void;
}

/** Per-state edge tint — a cheap, fun cue layered over the flag background. */
const RING: Record<MatchCardState, string> = {
  upcoming: "ring-ocean/30",
  open: "ring-flame/40",
  locked: "ring-stone-300 dark:ring-white/15",
  live: "ring-flame/70",
  final: "ring-pitch/40",
};

/** Frosted backdrop that keeps text crisp over any flag colors. */
const GLASS =
  "bg-white/75 backdrop-blur-sm ring-1 ring-black/5 dark:bg-stone-900/60 dark:ring-white/10";

function StatusPill({
  data,
  opensAt,
  onExpire,
}: {
  data: MatchCardData;
  opensAt?: string;
  onExpire?: () => void;
}) {
  switch (data.state) {
    case "live":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-flame px-2.5 py-0.5 text-white shadow-sm">
          <span className="live-dot h-2 w-2 rounded-full bg-white" />
          LIVE{data.minute ? ` ${data.minute}'` : ""}
        </span>
      );
    case "final":
      return (
        <span className="rounded-full bg-pitch px-2.5 py-0.5 text-white shadow-sm">
          FULL TIME
        </span>
      );
    case "locked":
      return (
        <span className={`rounded-full px-2.5 py-0.5 text-stone-600 dark:text-stone-200 ${GLASS}`}>
          🔒 Locked
        </span>
      );
    case "open":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-flame px-2.5 py-0.5 text-white shadow-sm">
          ⏳ closes in{" "}
          <Countdown target={data.kickoffAt} expiredLabel="closed" onExpire={onExpire} />
        </span>
      );
    case "upcoming":
      return opensAt ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-ocean px-2.5 py-0.5 text-white shadow-sm">
          🔓 opens in{" "}
          <Countdown target={opensAt} expiredLabel="now open" onExpire={onExpire} />
        </span>
      ) : (
        <span className={`rounded-full px-2.5 py-0.5 text-ocean ${GLASS}`}>Upcoming</span>
      );
  }
}

/** A team's name in a glass chip — flags carry the identity, this keeps it legible. */
function TeamName({ code, label }: { code: string | null; label?: string | null }) {
  return (
    <span
      className={`line-clamp-2 min-w-0 flex-1 rounded-lg px-2 py-1 text-center text-sm font-extrabold leading-tight text-stone-800 dark:text-stone-50 ${GLASS}`}
    >
      {teamLabel(code, label)}
    </span>
  );
}

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
    <div className={`rounded-xl px-3 py-1 text-center ${GLASS}`}>
      <div className={`flex items-center gap-1.5 text-2xl font-black tabular-nums ${tone}`}>
        <span>{home}</span>
        <span className="text-stone-400">:</span>
        <span>{away}</span>
      </div>
      {label && (
        <div className="text-[9px] font-bold uppercase tracking-wide text-stone-400">
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * One half of the card's background, painted with a team's actual flag (via the
 * flag-icons `fi fi-xx` class) and feathered on its inner edge so the home and
 * away halves cross-blend in the exact middle. Unknown teams (knockout
 * placeholders) fall back to their neutral colour.
 */
function FlagHalf({ code, side }: { code: string | null; side: "left" | "right" }) {
  const team = teamByCode(code);
  const mask =
    side === "left"
      ? "linear-gradient(to right, #000 55%, transparent 100%)"
      : "linear-gradient(to left, #000 55%, transparent 100%)";
  // Positioning AND size go inline: flag-icons' `.fi` rule sets
  // `position: relative; width: 1.333em` with the same specificity as Tailwind
  // utilities, and is imported later — so `absolute`/`w-[…]` classes lose. Inline
  // styles beat any class selector, reliably pinning each half to its edge and
  // stretching it to fill (and overlap at) the seam.
  const style: React.CSSProperties = {
    position: "absolute",
    top: 0,
    width: "62%",
    height: "100%",
    ...(side === "left" ? { left: 0 } : { right: 0 }),
    backgroundSize: "cover",
    WebkitMaskImage: mask,
    maskImage: mask,
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

export function MatchCard({ data, opensAt, entry, pick, footer, onExpire }: MatchCardProps) {
  const editing = data.state === "open" && entry != null;
  const hasResult =
    (data.state === "live" || data.state === "final") &&
    data.homeGoals != null &&
    data.awayGoals != null;

  // The center "scoreboard": the result, a revealed pick, or — failing all — the
  // kickoff time. While editing it stays empty: the steppers below already show
  // (and own) the live entry, so a center score would just duplicate them.
  let center: React.ReactNode = null;
  if (!editing) {
    if (hasResult) {
      center = (
        <Score
          home={data.homeGoals!}
          away={data.awayGoals!}
          tone={data.state === "live" ? "text-flame" : "text-stone-800 dark:text-stone-100"}
        />
      );
    } else if (pick) {
      center = <Score home={pick.home} away={pick.away} tone="text-grape" label="your pick" />;
    } else {
      center = (
        <div className={`rounded-xl px-3 py-1 text-center text-stone-500 dark:text-stone-300 ${GLASS}`}>
          <div className="text-base font-black">{formatKickoffTime(data.kickoffAt)}</div>
          <div className="text-[9px] font-bold uppercase tracking-wide text-stone-400">kickoff</div>
        </div>
      );
    }
  }

  return (
    <div
      className={`relative animate-pop-in overflow-hidden rounded-2xl bg-white shadow-md ring-1 dark:bg-stone-900 ${RING[data.state]}`}
    >
      {/* The two teams' flags fill the whole card, feathered together at the seam. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-90">
        <FlagHalf code={data.homeCode} side="left" />
        <FlagHalf code={data.awayCode} side="right" />
      </div>
      {/* A gentle scrim takes the edge off saturation so chips read cleanly. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-white/25 dark:bg-stone-950/35"
      />

      <div className="relative flex flex-col gap-2 p-3 text-xs font-bold">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate rounded-full px-2.5 py-0.5 text-stone-600 dark:text-stone-200 ${GLASS}`}
          >
            {formatStageLabel(data.groupLabel, data.stage ?? "group")}
          </span>
          <StatusPill data={data} opensAt={opensAt} onExpire={onExpire} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <TeamName code={data.homeCode} label={data.homeLabel} />
          {center && <div className="shrink-0">{center}</div>}
          <TeamName code={data.awayCode} label={data.awayLabel} />
        </div>

        {entry && (
          <div
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${GLASS} ${
              editing ? "" : "opacity-70"
            }`}
          >
            <div className="flex items-center justify-center gap-4">
              <Stepper
                size="sm"
                value={entry.home}
                disabled={!editing}
                onChange={(n) => entry.onChange("home", n)}
              />
              <span className="text-lg font-black text-stone-400">:</span>
              <Stepper
                size="sm"
                value={entry.away}
                disabled={!editing}
                onChange={(n) => entry.onChange("away", n)}
              />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wide text-stone-400">
              {editing ? "your call" : "your pick"}
            </span>
          </div>
        )}

        {footer && (
          <div className={`rounded-xl px-3 py-1.5 text-stone-700 dark:text-stone-100 ${GLASS}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
