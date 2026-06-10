"use client";

import { useState } from "react";

/**
 * Shares a link to the group's public leaderboard page (/s/<code>), whose
 * OpenGraph image is the standings podium — so the link unfurls into a picture
 * in chat apps. Sharing a URL (rather than a file) works everywhere, including
 * browsers like Brave that block Web Share file sharing. Falls back to copying
 * the link where the native share sheet isn't available.
 */
export function ShareLeaderboard({
  code,
  groupName,
}: {
  code: string;
  groupName?: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  }

  async function share() {
    const url = `${window.location.origin}/s/${code}`;
    const data = {
      url,
      title: groupName ? `${groupName} · Leaderboard` : "World Cup 2026 Leaderboard",
      text: groupName
        ? `${groupName} — World Cup 2026 standings`
        : "World Cup 2026 standings",
    };

    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch (e) {
      // The user dismissing the sheet isn't an error; anything else falls
      // through to copying the link.
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
      className="rounded-full glass px-4 py-2 text-sm font-bold text-grape transition active:scale-95 dark:text-violet-300"
    >
      {msg ?? "📸 Share"}
    </button>
  );
}
