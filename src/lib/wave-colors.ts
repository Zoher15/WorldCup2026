/**
 * Builds the brand wave's gradient stops from the teams of the match that's
 * currently "on" (live, or next up — see wave-match.ts). The wave is the single
 * gradient shared by the wordmark, page headings, the hero/live card rim and the
 * live-card glow (see `--wave-stops` in globals.css): the home team's flag
 * colours sweep into the away team's, left to right, so the whole UI wears the
 * matchup — the USA's red/white/blue, Brazil's green/yellow/blue, etc.
 *
 * Each team's real flag palette comes from the generated FLAG_COLORS table
 * (scripts/build-flag-colors.mjs). Flag colours aren't chosen for a near-black
 * UI, though — many are deep navy, blood red or literal black/white. So each is
 * lifted to a legibility floor: dark hues are raised into a readable band and
 * kept saturated; near-neutral tones (a flag's black or white) are kept neutral
 * but floored to a visible lightness (true black can't show on a near-black
 * background, so it reads as a light silver). The glow and rim tolerate dark
 * tones, but they share one colour list with the text by design, so the floor
 * governs all three.
 *
 * Pure (depends only on the static tables) and framework-free, so it runs on the
 * server and is trivially testable.
 */

import { teamColor } from "./fifa.ts";
import { FLAG_COLORS } from "../data/flag-colors.ts";

/** Brand wave fallback when no match drives the colours (flame, grape, ocean). */
export const WAVE_FALLBACK = ["#ff5a36", "#6b2fb3", "#1e8fd5"] as const;

/** Saturated colours: lift dark hues into a readable band, keep them vivid. */
const SAT_FLOOR = 0.5;
const L_FLOOR = 0.52;
const L_CEIL = 0.85;
/** Below this chroma a colour is treated as neutral (white/grey/black) — HSL
 *  saturation is unstable near black/white, so chroma is the reliable test. */
const NEUTRAL_CHROMA = 0.08;
/** Neutral colours keep their hue-less tone but are floored to stay visible (so
 *  a flag's black becomes a light silver rather than vanishing). */
const NEUTRAL_L_FLOOR = 0.62;

/** Parse `#rgb` / `#rrggbb` into [r, g, b] in 0–1, or null if malformed. */
function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [
    number,
    number,
    number,
  ];
}

/** RGB (0–1) → HSL (h in 0–360, s/l in 0–1). */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

/** HSL → `#rrggbb`. */
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Lift a flag colour to the legibility floor. Saturated hues keep their hue and
 * are clamped into a readable lightness band (deep navy → medium blue); neutral
 * tones (white/grey/black) stay neutral but are floored to a visible lightness.
 * Malformed input falls back to the brand flame so a bad value can't blank the
 * wordmark.
 */
export function legibleWaveColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return WAVE_FALLBACK[0];
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < NEUTRAL_CHROMA) {
    return hslToHex(0, 0, Math.max((max + min) / 2, NEUTRAL_L_FLOOR));
  }
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToHex(
    h,
    Math.max(s, SAT_FLOOR),
    Math.min(Math.max(l, L_FLOOR), L_CEIL),
  );
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
 * A team's flag colours, lifted to the legibility floor and ordered as the flag
 * is (most-prominent first), each carrying its share of the flag's area. Falls
 * back to the single representative colour for a code with no flag palette
 * (knockout placeholders), or a neutral grey if even that is unknown.
 */
export function teamWaveColors(code: string): WaveStop[] {
  const palette = FLAG_COLORS[code.toUpperCase()];
  if (!palette) return [{ color: legibleWaveColor(teamColor(code)), weight: 1 }];
  return mergeAdjacent(
    palette.map(([hex, weight]) => ({ color: legibleWaveColor(hex), weight })),
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
 * colours then the away team's, each lifted to the legibility floor and sized to
 * its share of the flag. Each team owns half the wave so the matchup stays
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
