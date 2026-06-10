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
 * Full host-city (metro) label from a venue string. The fixtures carry the metro
 * plus the stadium suburb in parentheses (e.g. "Los Angeles (Inglewood)",
 * "New York/New Jersey (East Rutherford)"); we drop the suburb and keep the
 * metro: "Los Angeles", "New York/New Jersey". Returns null for empty venues.
 */
export function formatHostCity(venue: string | null | undefined): string | null {
  if (!venue) return null;
  const city = venue.replace(/\s*\(.*\)\s*/, "").trim();
  return city || null;
}

/**
 * Compact a metro label for tight spots (the card header chip): keep the lead
 * city before a slash ("New York/New Jersey" -> "New York") and drop a trailing
 * "Bay Area" ("San Francisco Bay Area" -> "San Francisco"). Most cities are
 * already short and pass through unchanged.
 */
export function shortHostCity(city: string): string {
  return city.split("/")[0].trim().replace(/\s+Bay Area$/i, "");
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

/** Compact date for the card focal tile, e.g. "Sat, Jun 13". */
export function formatKickoffDateCompact(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
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

/** UTC calendar date key ("YYYY-MM-DD") for an instant — defaults to now. */
export function utcDateKey(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}
