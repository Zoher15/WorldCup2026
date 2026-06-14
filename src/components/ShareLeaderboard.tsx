"use client";

import { ShareButton } from "./ShareButton";

/**
 * Shares the group's leaderboard image (the PNG served at /s/<code>/og) via the
 * generic ShareButton. Group invites keep using the link preview — that's a
 * separate component.
 */
export function ShareLeaderboard({
  code,
  groupName,
}: {
  code: string;
  groupName?: string;
}) {
  return (
    <ShareButton
      url={`/s/${code}`}
      imagePath={`/s/${code}/og`}
      title={groupName ? `${groupName} · Leaderboard` : "World Cup 2026 Leaderboard"}
      caption={`${groupName ? `${groupName} — ` : ""}World Cup 2026 leaderboard 🏆`}
      fileName={`worldcup-${code}.png`}
      ariaLabel="Share the leaderboard image"
    />
  );
}
