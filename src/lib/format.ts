/** Shared kickoff date/time formatting (viewer's local timezone). */

import type { Stage } from "./types";

/**
 * Human label for a match's place in the tournament: "Group A" for group-stage
 * matches, else the stage name with underscores spaced out (e.g. "round of 32").
 */
export function formatStageLabel(
  groupLabel: string | null | undefined,
  stage: Stage = "group",
): string {
  return groupLabel ? `Group ${groupLabel}` : stage.replace(/_/g, " ");
}

/**
 * Clean host-city label from a venue string. The fixtures carry the metro plus
 * the stadium suburb in parentheses (e.g. "Los Angeles (Inglewood)",
 * "New York/New Jersey (East Rutherford)"); for a card chip we want just the
 * city: "Los Angeles", "New York/New Jersey". Returns null for empty venues.
 */
export function formatHostCity(venue: string | null | undefined): string | null {
  if (!venue) return null;
  const city = venue.replace(/\s*\(.*\)\s*/, "").trim();
  return city || null;
}

export function formatKickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatKickoffDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatKickoffDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
