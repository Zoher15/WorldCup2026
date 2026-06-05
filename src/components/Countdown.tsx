"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * A live ticking countdown to `target` (ISO). Renders nothing time-specific on
 * the server (avoids hydration mismatch) and updates every second on the client.
 * Calls onExpire once when it reaches zero.
 */
export function Countdown({
  target,
  expiredLabel = "—",
  onExpire,
}: {
  target: string;
  expiredLabel?: string;
  onExpire?: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = now === null ? null : Date.parse(target) - now;

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && onExpire) onExpire();
    // fire only on the transition into expired
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining !== null && remaining <= 0]);

  if (remaining === null) return <span className="tabular-nums">…</span>;
  if (remaining <= 0) return <span className="tabular-nums">{expiredLabel}</span>;
  return <span className="tabular-nums">{format(remaining)}</span>;
}
