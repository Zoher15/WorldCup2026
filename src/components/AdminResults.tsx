"use client";

import { useMemo, useState, useTransition } from "react";
import { Flag } from "./Flag";
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
      className={`rounded-2xl p-3 shadow ring-1 ring-black/5 dark:ring-white/10 dark:text-stone-100 ${
        m.resultConfirmed ? "bg-pitch/10 dark:bg-pitch/20" : "bg-white/85 dark:bg-stone-800/85"
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
          className="w-12 rounded-lg border border-stone-200 px-2 py-1.5 text-center font-bold dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
        />
        <span className="font-black text-stone-300">:</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className="w-12 rounded-lg border border-stone-200 px-2 py-1.5 text-center font-bold dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
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
          className="mt-2 w-full rounded-lg border border-stone-200 px-2 py-1.5 text-sm dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500"
        />
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        {msg && <span className="mr-auto text-xs font-bold text-stone-500 dark:text-stone-300">{msg}</span>}
        {m.resultConfirmed && (
          <button
            onClick={clear}
            disabled={pending}
            className="rounded-full bg-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 disabled:opacity-50 dark:bg-stone-700 dark:text-stone-200"
          >
            Clear
          </button>
        )}
        <button
          onClick={confirm}
          disabled={pending}
          className="rounded-full bg-pitch px-4 py-1.5 text-xs font-bold text-white shadow disabled:opacity-50"
        >
          {m.resultConfirmed ? "Update" : "Confirm result"}
        </button>
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
          <h1 className="text-2xl font-black text-grape dark:text-violet-300">Results</h1>
          <p className="text-sm text-stone-500 dark:text-stone-300">
            {confirmed} of {matches.length} confirmed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="rounded-full bg-ocean px-4 py-2 text-sm font-bold text-white shadow disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync live scores"}
          </button>
          <form action={adminLogoutAction}>
            <button className="rounded-full bg-stone-200 px-4 py-2 text-sm font-bold text-stone-700 dark:bg-stone-700 dark:text-stone-200">
              Sign out
            </button>
          </form>
        </div>
      </div>
      {syncMsg && (
        <p className="mb-3 rounded-xl bg-ocean/10 px-4 py-2 text-sm font-bold text-ocean">
          {syncMsg}
        </p>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by team or match #"
        className="mb-4 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 font-medium outline-none focus:border-grape focus:ring-2 focus:ring-grape/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
      />

      <div className="space-y-2">
        {filtered.map((m) => (
          <Row key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
