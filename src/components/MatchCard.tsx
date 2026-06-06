"use client";

import { useState } from "react";
import { Flag } from "./Flag";
import { Stepper } from "./Stepper";
import { teamLabel } from "@/lib/fifa";
import { formatKickoffDateTime } from "@/lib/format";
import type { MatchStatus } from "@/lib/types";

export interface MatchCardData {
  homeCode: string | null;
  awayCode: string | null;
  homeLabel?: string; // fallback text for knockout placeholders
  awayLabel?: string;
  kickoffAt: string;
  venue?: string;
  status: MatchStatus;
  minute?: number | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  locked?: boolean;
}

function StatusPill({ data }: { data: MatchCardData }) {
  if (data.status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-flame px-2.5 py-1 text-xs font-bold text-white">
        <span className="live-dot h-2 w-2 rounded-full bg-white" />
        LIVE {data.minute ? `${data.minute}'` : ""}
      </span>
    );
  }
  if (data.status === "finished") {
    return (
      <span className="rounded-full bg-stone-700 px-2.5 py-1 text-xs font-bold text-white">
        FULL TIME
      </span>
    );
  }
  return (
    <span className="rounded-full bg-ocean/15 px-2.5 py-1 text-xs font-bold text-ocean">
      {formatKickoffDateTime(data.kickoffAt)}
    </span>
  );
}

function TeamRow({
  code,
  label,
  goals,
}: {
  code: string | null;
  label?: string;
  goals?: number | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <Flag code={code} size="lg" />
      <span className="flex-1 truncate text-lg font-bold">
        {teamLabel(code, label)}
      </span>
      {goals != null && (
        <span className="text-2xl font-extrabold tabular-nums">{goals}</span>
      )}
    </div>
  );
}

export function MatchCard({ data }: { data: MatchCardData }) {
  const showResult = data.status === "live" || data.status === "finished";
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const locked = data.locked ?? showResult;

  return (
    <div className="animate-pop-in rounded-3xl bg-white/85 p-5 shadow-lg ring-1 ring-black/5 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <StatusPill data={data} />
        {data.venue && (
          <span className="truncate text-xs font-medium text-stone-400">
            {data.venue}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <TeamRow code={data.homeCode} label={data.homeLabel} goals={showResult ? data.homeGoals : undefined} />
        <TeamRow code={data.awayCode} label={data.awayLabel} goals={showResult ? data.awayGoals : undefined} />
      </div>

      {!showResult && (
        <div className="mt-4 rounded-2xl bg-cream p-3">
          <div className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-stone-400">
            {locked ? "Prediction locked" : "Your prediction"}
          </div>
          <div className="flex items-center justify-center gap-5">
            <Stepper value={home} onChange={setHome} disabled={locked} size="sm" />
            <span className="text-xl font-black text-stone-300">:</span>
            <Stepper value={away} onChange={setAway} disabled={locked} size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}
