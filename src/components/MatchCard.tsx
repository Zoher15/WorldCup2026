"use client";

import { Flag } from "./Flag";
import { Stepper } from "./Stepper";
import { Countdown } from "./Countdown";
import { teamColor, teamLabel } from "@/lib/fifa";
import { formatKickoffTime, formatStageLabel } from "@/lib/format";
import type { Stage } from "@/lib/types";

/**
 * Every place a match shows up — predicting, locked, live, finished — speaks
 * one visual language: a festive scoreboard. The *state* drives the header
 * tint, the status pill, and what lives in the center "stage" (score-entry
 * steppers, a revealed pick, the live/final score, or the kickoff time).
 */
export type MatchCardState = "upcoming" | "open" | "locked" | "live" | "final";

export interface MatchCardData {
  homeCode: string | null;
  awayCode: string | null;
  homeLabel?: string | null; // fallback text for knockout placeholders
  awayLabel?: string | null;
  kickoffAt: string;
  venue?: string | null;
  stage?: Stage;
  groupLabel?: string | null;
  matchNumber?: number | null;
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
  /** Force the two-flag ombre on/off (defaults to on for open cards). */
  ombre?: boolean;
}

/** Per-state festive treatment: card edge tint + header gradient. */
const THEME: Record<MatchCardState, { ring: string; header: string }> = {
  upcoming: {
    ring: "ring-ocean/20",
    header: "bg-gradient-to-r from-ocean/10 to-grape/10 text-ocean",
  },
  open: {
    ring: "ring-flame/30",
    header: "bg-gradient-to-r from-sunburst/50 to-flame/20 text-flame",
  },
  locked: {
    ring: "ring-stone-200 dark:ring-white/10",
    header:
      "bg-gradient-to-r from-stone-200 to-stone-100 text-stone-500 dark:from-stone-700 dark:to-stone-800 dark:text-stone-300",
  },
  live: {
    ring: "ring-flame/60",
    header: "bg-gradient-to-r from-flame to-flame/70 text-white",
  },
  final: {
    ring: "ring-pitch/30",
    header: "bg-gradient-to-r from-pitch/15 to-ocean/10 text-pitch",
  },
};

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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-2.5 py-0.5 font-bold">
          <span className="live-dot h-2 w-2 rounded-full bg-white" />
          LIVE{data.minute ? ` ${data.minute}'` : ""}
        </span>
      );
    case "final":
      return (
        <span className="rounded-full bg-pitch px-2.5 py-0.5 font-bold text-white">
          FULL TIME
        </span>
      );
    case "locked":
      return (
        <span className="rounded-full bg-stone-300 px-2.5 py-0.5 font-bold text-stone-600">
          🔒 Locked
        </span>
      );
    case "open":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-flame px-2.5 py-0.5 font-bold text-white">
          ⏳ closes in{" "}
          <Countdown target={data.kickoffAt} expiredLabel="closed" onExpire={onExpire} />
        </span>
      );
    case "upcoming":
      return opensAt ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-ocean px-2.5 py-0.5 font-bold text-white">
          🔓 opens in{" "}
          <Countdown target={opensAt} expiredLabel="now open" onExpire={onExpire} />
        </span>
      ) : (
        <span className="rounded-full bg-ocean/15 px-2.5 py-0.5 font-bold text-ocean">
          Upcoming
        </span>
      );
  }
}

function TeamSide({
  code,
  label,
}: {
  code: string | null;
  label?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <Flag code={code} size="lg" />
      <span className="line-clamp-2 max-w-full text-center text-sm font-bold leading-tight text-stone-700 dark:text-stone-100">
        {teamLabel(code, label)}
      </span>
    </div>
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
    <div className="text-center">
      <div className={`flex items-center gap-2 text-3xl font-black tabular-nums ${tone}`}>
        <span>{home}</span>
        <span className="text-stone-300">:</span>
        <span>{away}</span>
      </div>
      {label && (
        <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">
          {label}
        </div>
      )}
    </div>
  );
}

export function MatchCard({
  data,
  opensAt,
  entry,
  pick,
  footer,
  onExpire,
  ombre: ombreProp,
}: MatchCardProps) {
  const theme = THEME[data.state];
  const editing = data.state === "open" && entry != null;
  const hasResult =
    (data.state === "live" || data.state === "final") &&
    data.homeGoals != null &&
    data.awayGoals != null;

  // The center "scoreboard" number: the result, your live entry (updates as you
  // tap the steppers below), a revealed pick, or — failing all — the kickoff time.
  let center: React.ReactNode;
  if (hasResult) {
    center = (
      <Score
        home={data.homeGoals!}
        away={data.awayGoals!}
        tone={data.state === "live" ? "text-flame" : "text-stone-800 dark:text-stone-100"}
      />
    );
  } else if (editing) {
    center = <Score home={entry!.home} away={entry!.away} tone="text-flame" label="your call" />;
  } else if (pick) {
    center = <Score home={pick.home} away={pick.away} tone="text-grape" label="your pick" />;
  } else {
    center = (
      <div className="text-center text-stone-400">
        <div className="text-lg font-black">{formatKickoffTime(data.kickoffAt)}</div>
        <div className="text-[10px] font-bold uppercase tracking-wide">kickoff</div>
      </div>
    );
  }

  // Every card wears a soft ombre of the two flags — home colour on the left
  // half, away colour on the right. Callers can still force it off.
  const ombre = ombreProp ?? true;

  return (
    <div
      className={`relative animate-pop-in overflow-hidden rounded-3xl bg-white/90 shadow-lg ring-1 dark:bg-stone-800/90 ${theme.ring} backdrop-blur`}
    >
      {ombre && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background: `linear-gradient(100deg, ${teamColor(data.homeCode)} 0%, ${teamColor(data.homeCode)} 35%, ${teamColor(data.awayCode)} 65%, ${teamColor(data.awayCode)} 100%)`,
          }}
        />
      )}

      <div className="relative">
        <div
          className={`flex items-center justify-between gap-2 px-4 py-2 text-xs font-bold ${theme.header}`}
        >
          <span className="truncate">
            {data.matchNumber ? `#${data.matchNumber} · ` : ""}
            {formatStageLabel(data.groupLabel, data.stage ?? "group")}
            {data.venue ? ` · ${data.venue}` : ""}
          </span>
          <StatusPill data={data} opensAt={opensAt} onExpire={onExpire} />
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <TeamSide code={data.homeCode} label={data.homeLabel} />
            <div className="flex shrink-0 items-center justify-center">{center}</div>
            <TeamSide code={data.awayCode} label={data.awayLabel} />
          </div>

          {entry && (
            <div
              className={`mt-3 flex items-center justify-center gap-4 rounded-2xl py-2 ${
                editing
                  ? "bg-cream/80 dark:bg-stone-700/60"
                  : "bg-stone-100/80 dark:bg-stone-800/70"
              }`}
            >
              <Stepper
                size="sm"
                value={entry.home}
                disabled={!editing}
                onChange={(n) => entry.onChange("home", n)}
              />
              <span className="text-xl font-black text-stone-300">:</span>
              <Stepper
                size="sm"
                value={entry.away}
                disabled={!editing}
                onChange={(n) => entry.onChange("away", n)}
              />
            </div>
          )}
        </div>

        {footer && (
          <div className="border-t border-black/5 bg-cream/60 px-4 py-2 text-xs font-bold dark:border-white/10 dark:bg-stone-800/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
