"use client";

import { ShareButton } from "./ShareButton";

/**
 * Shares a player's achievements image (the PNG served at /s/<code>/p/<id>/og)
 * via the generic ShareButton. The shared link (/s/<code>/p/<id>) unfurls into
 * the scorecard — points, 🔥 streak, 🎯 exact scores — and drops recipients into
 * the join/profile flow.
 */
export function ShareAchievements({
  code,
  userId,
  displayName,
  groupName,
  points,
  streak,
  exact,
}: {
  code: string;
  userId: string;
  displayName: string;
  groupName?: string;
  points: number;
  streak: number;
  exact: number;
}) {
  const bits = [`${points} pts`];
  if (streak >= 2) bits.push(`🔥 ${streak} in a row`);
  if (exact >= 1) bits.push(`🎯 ${exact} exact`);
  return (
    <ShareButton
      url={`/s/${code}/p/${userId}`}
      imagePath={`/s/${code}/p/${userId}/og`}
      title={`${displayName}${groupName ? ` · ${groupName}` : ""}`}
      caption={`${displayName}'s World Cup 2026 scorecard — ${bits.join(" · ")} ⚽`}
      fileName={`worldcup-${code}-${userId}.png`}
      ariaLabel="Share this scorecard"
    />
  );
}
