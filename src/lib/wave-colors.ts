/**
 * Builds the brand wave's gradient stops from the teams of the match that's
 * currently "on" (live, or next up — see wave-match.ts). The wave is the single
 * gradient shared by the wordmark, page headings, the hero/live card rim and the
 * live-card glow (see `--wave-stops` in globals.css): the home team's flag
 * colours sweep into the away team's, left to right, so the whole UI wears the
 * matchup — the USA's red/white/blue, Brazil's green/yellow/blue, etc.
 *
 * Each team's real flag palette comes from the generated FLAG_COLORS table
 * (scripts/build-flag-colors.mjs), and the wave uses those colours AS-IS — no
 * lightening, no saturation tweak. A flag's black stays black, its navy stays
 * navy. On the near-black UI a dark band reads as a dim stretch of the wave (and
 * the gradient-clipped wordmark dips toward invisible across it), which is the
 * honest, unmodified flag rather than an artificial recolour.
 *
 * Pure (depends only on the static tables) and framework-free, so it runs on the
 * server and is trivially testable.
 */

import { teamColor } from "./fifa.ts";
import { FLAG_COLORS } from "../data/flag-colors.ts";

/** Brand wave fallback when no match drives the colours (flame, grape, ocean). */
export const WAVE_FALLBACK = ["#ff5a36", "#6b2fb3", "#1e8fd5"] as const;

/**
 * Validate and normalize a flag colour to lowercase `#rrggbb`, expanding `#rgb`
 * shorthand. The colour is returned unchanged otherwise — we use the real flag
 * hue, however dark. Malformed input falls back to the brand flame so a bad value
 * can't blank the wordmark.
 */
export function normalizeWaveColor(hex: string): string {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return WAVE_FALLBACK[0];
  return `#${h.toLowerCase()}`;
}

/** A wave colour with its share of the wave's width (its band size). */
export interface WaveStop {
  color: string;
  weight: number;
}

/** Merge runs of the same colour into one band, summing their weights, so
 *  adjacent stops never sit flat (e.g. two flags meeting on white). */
function mergeAdjacent(stops: WaveStop[]): WaveStop[] {
  const out: WaveStop[] = [];
  for (const s of stops) {
    const last = out[out.length - 1];
    if (last && last.color === s.color) last.weight += s.weight;
    else out.push({ ...s });
  }
  return out;
}

/** Rescale a set of weights so they sum to `total`. */
function scaleTo(stops: WaveStop[], total: number): WaveStop[] {
  const sum = stops.reduce((a, s) => a + s.weight, 0) || 1;
  return stops.map((s) => ({ color: s.color, weight: (s.weight / sum) * total }));
}

/**
 * A team's flag colours, used as-is and ordered as the flag is (most-prominent
 * first), each carrying its share of the flag's area. Falls back to the single
 * representative colour for a code with no flag palette (knockout placeholders),
 * or a neutral grey if even that is unknown.
 */
export function teamWaveColors(code: string): WaveStop[] {
  const palette = FLAG_COLORS[code.toUpperCase()];
  if (!palette) return [{ color: normalizeWaveColor(teamColor(code)), weight: 1 }];
  return mergeAdjacent(
    palette.map(([hex, weight]) => ({ color: normalizeWaveColor(hex), weight })),
  );
}

/** Turn weighted bands into positioned CSS stops (`#rrggbb p%`): each colour is
 *  pinned at the centre of its band, so a colour's dwell across the wave matches
 *  its share — a flag's dominant field spreads wide, a thin stripe just flashes
 *  past, instead of every colour getting an equal slice. */
function positionedStops(stops: WaveStop[]): string[] {
  const sum = stops.reduce((a, s) => a + s.weight, 0) || 1;
  const out: string[] = [];
  let cumulative = 0;
  for (const s of stops) {
    const w = s.weight / sum;
    const pos = Math.round((cumulative + w / 2) * 1000) / 10;
    out.push(`${s.color} ${pos}%`);
    cumulative += w;
  }
  return out;
}

/**
 * The wave's positioned gradient stops for a matchup: the home team's flag
 * colours then the away team's, used as-is and sized to their share of the flag.
 * Each team owns half the wave so the matchup stays
 * balanced regardless of how many colours its flag has. With no match (or unknown
 * codes on both sides) it returns the brand flame→grape→ocean fallback; a single
 * known team fills the whole wave, padded to at least two stops so it always
 * renders as a sweep.
 */
export function waveStopsForMatch(
  homeCode: string | null | undefined,
  awayCode: string | null | undefined,
): string[] {
  const home = homeCode ? teamWaveColors(homeCode) : [];
  const away = awayCode ? teamWaveColors(awayCode) : [];

  let stops: WaveStop[];
  if (home.length && away.length) {
    // Split the wave down the middle: each flag fills its half, its colours
    // sized within it by area.
    stops = mergeAdjacent([...scaleTo(home, 0.5), ...scaleTo(away, 0.5)]);
  } else {
    stops = mergeAdjacent([...home, ...away]);
  }

  if (stops.length === 0) {
    stops = WAVE_FALLBACK.map((color) => ({ color, weight: 1 }));
  } else if (stops.length === 1) {
    stops = [stops[0], { color: WAVE_FALLBACK[WAVE_FALLBACK.length - 1], weight: stops[0].weight }];
  }
  return positionedStops(stops);
}
