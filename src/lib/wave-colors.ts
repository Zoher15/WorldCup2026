/**
 * Derives the brand wave's colours from the teams of the match that's currently
 * "on" (live, or next up — see wave-match.ts). The wave is the single gradient
 * shared by the wordmark, page headings, the hero/live card rim and the live-card
 * glow (see `--wave-from` / `--wave-mid` / `--wave-to` in globals.css): the left
 * team's colour sweeps through a crest into the right team's colour, so the whole
 * UI wears the matchup.
 *
 * Flag colours aren't chosen for a near-black UI — many are deep navy or blood
 * red (USA #0A3161, Germany #DD0000) that would vanish as gradient-clipped text
 * on the dark stadium background. So each colour is lifted to a legibility floor:
 * a minimum lightness and saturation that keeps it recognisably the flag's hue
 * while staying readable. The glow and rim tolerate dark tones, but they share
 * one colour with the text by design, so the floor governs all three.
 *
 * Pure (depends only on the static TEAMS table) and framework-free, so it runs
 * on the server and is trivially testable.
 */

import { teamColor } from "./fifa.ts";

/** Brand wave fallback when no match drives the colours (flame → ocean). */
export const WAVE_FALLBACK = { from: "#ff5a36", to: "#1e8fd5" } as const;

/**
 * Legibility floor for a wave colour on the dark UI. Lightness is clamped into a
 * band: a floor so deep tones read as gradient-clipped text, and a ceiling so a
 * bright flag (Ecuador yellow) doesn't wash into white. Saturation gets a floor
 * so a lifted dark navy stays a vivid blue rather than going chalky.
 */
const MIN_LIGHTNESS = 0.55;
const MAX_LIGHTNESS = 0.72;
const MIN_SATURATION = 0.5;

/**
 * How close two wave colours must be (Euclidean distance in 0–1 RGB, where 0 is
 * identical and ~1.73 is the max) before the midpoint is treated as a "same
 * colour" matchup and lifted into a crest instead of a flat band.
 */
const SIMILAR_THRESHOLD = 0.3;
/** Crest shaping for a same-colour matchup: lighten and desaturate the midpoint
 *  into a soft neutral highlight (capped so it never blows out to white). */
const CREST_LIGHTEN = 0.18;
const CREST_MAX_LIGHTNESS = 0.82;
const CREST_SATURATION_SCALE = 0.5;

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
 * Lift a flag colour to the legibility floor: keep its hue, clamp saturation and
 * lightness into the readable band. Malformed input falls back to the brand
 * flame so a bad value can never blank the wordmark.
 */
export function legibleWaveColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return WAVE_FALLBACK.from;
  const [h, s, l] = rgbToHsl(...rgb);
  const clampedS = Math.max(s, MIN_SATURATION);
  const clampedL = Math.min(Math.max(l, MIN_LIGHTNESS), MAX_LIGHTNESS);
  return hslToHex(h, clampedS, clampedL);
}

/** Linear sRGB midpoint of two colours — exactly what CSS paints at the 50% mark
 *  of a two-stop `from → to` gradient, so using it as the middle stop leaves a
 *  distinct matchup looking identical to a smooth two-colour sweep. */
function mixHex(a: string, b: string): string {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return a;
  const to = (i: number) =>
    Math.round(((ra[i] + rb[i]) / 2) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(0)}${to(1)}${to(2)}`;
}

/** Euclidean distance between two colours in 0–1 RGB; 0 means identical. */
function rgbDistance(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return Infinity;
  return Math.hypot(ra[0] - rb[0], ra[1] - rb[1], ra[2] - rb[2]);
}

/**
 * The wave's middle stop. For a normal matchup it's the plain midpoint of
 * `from → to`, so the three-stop gradient renders identically to a smooth
 * two-stop sweep. When the two flag colours are close (e.g. two reds — Egypt vs
 * Iraq), that midpoint would be a near-flat band, so it's lifted into a soft,
 * desaturated crest: a neutral highlight that keeps the wave legible and lets the
 * drift catch the light, without inventing a foreign hue.
 */
function waveMid(from: string, to: string): string {
  const blend = mixHex(from, to);
  if (rgbDistance(from, to) >= SIMILAR_THRESHOLD) return blend;
  const rgb = parseHex(blend);
  if (!rgb) return blend;
  const [h, s, l] = rgbToHsl(...rgb);
  return hslToHex(
    h,
    s * CREST_SATURATION_SCALE,
    Math.min(l + CREST_LIGHTEN, CREST_MAX_LIGHTNESS),
  );
}

/**
 * The wave's `{ from, mid, to }` for a matchup: the home team's colour on the
 * left, the away team's on the right, each lifted to the legibility floor, with a
 * midpoint that crests when the two are too alike (see `waveMid`). With no match
 * (or unknown codes on both sides) it returns the brand flame → ocean fallback so
 * the UI still reads as branded.
 */
export function waveColorsForMatch(
  homeCode: string | null | undefined,
  awayCode: string | null | undefined,
): { from: string; mid: string; to: string } {
  const from = homeCode ? legibleWaveColor(teamColor(homeCode)) : WAVE_FALLBACK.from;
  const to = awayCode ? legibleWaveColor(teamColor(awayCode)) : WAVE_FALLBACK.to;
  return { from, mid: waveMid(from, to), to };
}
