"use client";

import { useState } from "react";

/**
 * Shares the group's leaderboard. Primarily it shares the rendered standings
 * **image** itself (the same PNG served at /s/<code>/og) via the Web Share API,
 * so it lands as a picture in WhatsApp/iMessage/Photos/Stories. Where file
 * sharing isn't available (e.g. Brave on Android, or desktop), it falls back to
 * sharing/copying the /s/<code> link, which still unfurls into the same image.
 *
 * (Group invites keep using the link preview — that's a separate component.)
 */
export function ShareLeaderboard({
  code,
  groupName,
}: {
  code: string;
  groupName?: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  }

  async function share() {
    const url = `${window.location.origin}/s/${code}`;
    const title = groupName ? `${groupName} · Leaderboard` : "World Cup 2026 Leaderboard";
    const caption = `${groupName ? `${groupName} — ` : ""}World Cup 2026 leaderboard 🏆`;

    // 1) Try to share the leaderboard image file itself. The caption carries the
    //    link too, since a shared image has no link of its own.
    let file: File | null = null;
    try {
      setBusy(true);
      const res = await fetch(`/s/${code}/og`);
      if (res.ok) {
        const blob = await res.blob();
        file = new File([blob], `worldcup-${code}.png`, { type: "image/png" });
      }
    } catch {
      // network/render hiccup — we'll fall back to the link below
    } finally {
      setBusy(false);
    }

    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title, text: `${caption}\nSee the full standings: ${url}` });
        flash("Shared ✓");
        return;
      } catch (e) {
        // Dismissing the sheet isn't an error; anything else falls through to
        // sharing the link instead.
        if ((e as Error)?.name === "AbortError") return;
      }
    }

    // 2) Fall back to sharing/copying the link (still unfurls into the image, so
    //    the caption omits the URL here).
    try {
      if (navigator.share) {
        await navigator.share({ url, title, text: caption });
        flash("Shared ✓");
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied ✓");
    } catch {
      flash("Couldn't share");
    }
  }

  return (
    <button
      onClick={share}
      disabled={busy}
      className="rounded-full glass px-4 py-2 text-sm font-bold text-grape transition active:scale-95 disabled:opacity-70 dark:text-violet-300"
    >
      {busy ? "Preparing…" : (msg ?? "📸 Share")}
    </button>
  );
}
