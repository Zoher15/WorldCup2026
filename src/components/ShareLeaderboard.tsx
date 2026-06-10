"use client";

import { useState } from "react";

/**
 * Shares a PNG snapshot of the leaderboard (rendered by /g/[code]/share). On
 * mobile this opens the native share sheet with the image attached via the Web
 * Share API; where file sharing isn't supported or the browser blocks it (most
 * desktops), it falls back to downloading the image so the user always gets the
 * picture. Only a genuine server-side render failure surfaces an error.
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
    setTimeout(() => setMsg(null), 2500);
  }

  function download(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function share() {
    setBusy(true);
    setMsg(null);

    // 1) Build the image on the server. This is the only step that can be a
    //    genuine error worth showing.
    let file: File;
    try {
      const res = await fetch(`/g/${code}/share?tab=${tab}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      if (!blob.size) throw new Error("empty image");
      file = new File([blob], `${code}-leaderboard.png`, { type: "image/png" });
    } catch {
      setBusy(false);
      flash("Couldn't build image");
      return;
    }

    // 2) Offer the native share sheet. If it's unsupported, or the browser
    //    blocks it (e.g. no file share targets, or lost user activation after
    //    the fetch), fall through to saving the file instead.
    try {
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: groupName ? `${groupName} · Leaderboard` : "Leaderboard",
          text: groupName
            ? `${groupName} — World Cup 2026 standings`
            : "World Cup 2026 standings",
        });
        setBusy(false);
        return;
      }
    } catch (e) {
      // The user dismissing the sheet isn't an error — leave it at that.
      if ((e as Error)?.name === "AbortError") {
        setBusy(false);
        return;
      }
      // Any other share failure: fall back to a download below.
    }

    download(file);
    setBusy(false);
    flash("Saved ✓");
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
