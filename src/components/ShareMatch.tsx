"use client";

import { ShareButton } from "./ShareButton";

/**
 * Shares a group's per-match board image (the PNG served at /s/<code>/m/<id>/og)
 * via the generic ShareButton. The shared link (/s/<code>/m/<id>) unfurls into
 * the fixture + everyone's predictions and drops recipients into the join/board
 * flow.
 */
export function ShareMatch({
  code,
  matchId,
  fixture,
  groupName,
}: {
  code: string;
  matchId: string;
  /** "Home v Away" for the caption; falls back to a generic label when unknown. */
  fixture?: string;
  groupName?: string;
}) {
  const what = fixture ?? "this match";
  return (
    <ShareButton
      url={`/s/${code}/m/${matchId}`}
      imagePath={`/s/${code}/m/${matchId}/og`}
      title={`${fixture ?? "Match predictions"}${groupName ? ` · ${groupName}` : ""}`}
      caption={`${groupName ? `${groupName} — ` : ""}predictions for ${what} ⚽`}
      fileName={`worldcup-${code}-${matchId}.png`}
      ariaLabel="Share these match predictions"
    />
  );
}
