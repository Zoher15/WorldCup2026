"use client";

import { useState } from "react";

/**
 * Shares a PNG snapshot of the leaderboard (rendered by /g/[code]/share). On
 * mobile this opens the native share sheet with the image attached via the Web
 * Share API; where file sharing isn't supported (most desktops) it falls back
 * to downloading the image.
 */
export function ShareLeaderboard({
  code,
  tab,
  groupName,
}: {
  code: string;
  tab: string;
  groupName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2000);
  }

  async function share() {
    setBusy(true);
    try {
      const res = await fetch(`/g/${code}/share?tab=${tab}`);
      if (!res.ok) throw new Error("render failed");
      const blob = await res.blob();
      const file = new File([blob], `${code}-leaderboard.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: groupName ? `${groupName} · Leaderboard` : "Leaderboard",
          text: groupName
            ? `${groupName} — World Cup 2026 standings`
            : "World Cup 2026 standings",
        });
      } else {
        // No file-share support (typically desktop): save the image instead.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        flash("Saved ✓");
      }
    } catch (e) {
      // The user dismissing the native share sheet isn't an error.
      if ((e as Error)?.name !== "AbortError") flash("Couldn't share");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={share}
      disabled={busy}
      className="rounded-full glass px-4 py-2 text-sm font-bold text-grape transition active:scale-95 disabled:opacity-50 dark:text-violet-300"
    >
      {busy ? "…" : (msg ?? "📸 Share")}
    </button>
  );
}
