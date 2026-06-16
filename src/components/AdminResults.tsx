"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "./Button";
import { Flag } from "./Flag";
import { inputClassesGrape, inputCompactGrape } from "./form-styles";
import { teamLabel } from "@/lib/fifa";
import { formatKickoffDateTime, formatStageLabel } from "@/lib/format";
import { isKnockoutStage } from "@/lib/polling";
import {
  setResultAction,
  clearResultAction,
  adminLogoutAction,
  syncNowAction,
} from "@/app/admin/actions";
import type { AdminMatch } from "@/lib/results";

// The two score inputs share the compact admin field token (border / surface /
// grape focus), plus their own width + centring. Kept a complete static string
// so Tailwind v4's source scan can see the class names.
const scoreInputClasses = `w-12 px-2 py-1.5 text-center font-bold ${inputCompactGrape}`;

function Row({ m }: { m: AdminMatch }) {
  const [home, setHome] = useState(m.homeGoals != null ? String(m.homeGoals) : "");
  const [away, setAway] = useState(m.awayGoals != null ? String(m.awayGoals) : "");
  const [adv, setAdv] = useState(m.advancedCode ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const knockout = isKnockoutStage(m.stage);

  function confirm() {
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (Number.isNaN(h) || Number.isNaN(a)) {
      setMsg("Enter both scores");
      return;
    }
    start(async () => {
      const res = await setResultAction({
        matchId: m.id,
        homeGoals: h,
        awayGoals: a,
        advancedCode: knockout ? adv.trim().toUpperCase() || null : null,
      });
      setMsg(res.ok ? "Saved ✓" : res.error ?? "Failed");
    });
  }

  function clear() {
    start(async () => {
      const res = await clearResultAction(m.id);
      if (res.ok) {
        setHome("");
        setAway("");
        setAdv("");
        setMsg("Cleared");
      } else {
        setMsg(res.error ?? "Failed");
      }
    });
  }

  return (
    <div
      className={`rounded-2xl p-3 text-stone-100 ${
        m.resultConfirmed
          ? "bg-pitch/20 shadow ring-1 ring-white/10"
          : "glass"
      }`}
    >
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-stone-400">
        <span>
          #{m.matchNumber} · {formatStageLabel(m.groupLabel, m.stage)}
        </span>
        <span>
          {formatKickoffDateTime(m.kickoffAt)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Flag code={m.homeCode} size="sm" />
          <span className="truncate text-sm font-bold">
            {teamLabel(m.homeCode, m.homeLabel)}
          </span>
        </div>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={home}
          onChange={(e) => setHome(e.target.value)}
          className={scoreInputClasses}
        />
        <span className="font-black text-stone-300">:</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className={scoreInputClasses}
        />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-bold">
            {teamLabel(m.awayCode, m.awayLabel)}
          </span>
          <Flag code={m.awayCode} size="sm" />
        </div>
      </div>
      {knockout && (
        <input
          value={adv}
          onChange={(e) => setAdv(e.target.value)}
          placeholder="Advanced team code (e.g. ARG)"
          className={`mt-2 w-full px-2 py-1.5 text-sm ${inputCompactGrape}`}
        />
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        {msg && <span className="mr-auto text-xs font-bold text-stone-300">{msg}</span>}
        {m.resultConfirmed && (
          <Button
            tone="muted"
            size="sm"
            onClick={clear}
            disabled={pending}
            className="px-3 py-1.5 text-xs"
          >
            Clear
          </Button>
        )}
        <Button
          tone="pitch"
          size="sm"
          onClick={confirm}
          disabled={pending}
          className="text-xs"
        >
          {m.resultConfirmed ? "Update" : "Confirm result"}
        </Button>
      </div>
    </div>
  );
}

export function AdminResults({ matches }: { matches: AdminMatch[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return matches;
    return matches.filter(
      (m) =>
        teamLabel(m.homeCode, m.homeLabel).toLowerCase().includes(s) ||
        teamLabel(m.awayCode, m.awayLabel).toLowerCase().includes(s) ||
        String(m.matchNumber ?? "").includes(s),
    );
  }, [matches, q]);

  const confirmed = matches.filter((m) => m.resultConfirmed).length;
  const [syncing, startSync] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  function syncNow() {
    startSync(async () => {
      const res = await syncNowAction();
      setSyncMsg(res.ok ? res.message ?? "Synced ✓" : res.error ?? "Sync failed");
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="gradient-text text-2xl font-black">Results</h1>
          <p className="text-sm text-stone-300">
            {confirmed} of {matches.length} confirmed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button tone="ocean" size="md" onClick={syncNow} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync live scores"}
          </Button>
          <form action={adminLogoutAction}>
            <Button type="submit" tone="muted" size="md">
              Sign out
            </Button>
          </form>
        </div>
      </div>
      {syncMsg && (
        <p className="mb-3 rounded-xl glass px-4 py-2 text-sm font-bold text-sky-400">
          {syncMsg}
        </p>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by team or match #"
        className={`mb-4 ${inputClassesGrape}`}
      />

      <div className="space-y-2">
        {filtered.map((m) => (
          <Row key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
