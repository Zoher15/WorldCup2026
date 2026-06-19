import { test } from "node:test";
import assert from "node:assert/strict";
import {
  legibleWaveColor,
  waveColorsForMatch,
  WAVE_FALLBACK,
} from "./wave-colors.ts";

/** Parse `#rrggbb` → channels in 0–1 plus HSL lightness/saturation, for asserts. */
function inspect(hex: string): {
  r: number;
  g: number;
  b: number;
  l: number;
  s: number;
} {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  assert.ok(m, `not a #rrggbb colour: ${hex}`);
  const n = parseInt(m![1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return { r, g, b, l, s };
}

// Lightness band the floor enforces (MIN 0.55 / MAX 0.72), with rounding slack.
const EPS = 0.01;

test("lifts a deep navy into the legible band, keeping it blue", () => {
  // USA #0A3161 is far too dark to read as clipped text on the dark UI.
  const { b, r, g, l } = inspect(legibleWaveColor("#0A3161"));
  assert.ok(l >= 0.55 - EPS, `lightness ${l} below floor`);
  assert.ok(l <= 0.72 + EPS, `lightness ${l} above ceiling`);
  assert.ok(b > r && b > g, "blue should still dominate");
});

test("pulls an over-bright flag down to the ceiling", () => {
  // Ecuador #FFDD00 (yellow, L≈0.5) — already legible, but capped, not washed.
  const { l } = inspect(legibleWaveColor("#FFDD00"));
  assert.ok(l <= 0.72 + EPS, `lightness ${l} above ceiling`);
});

test("preserves a vivid red's hue while floored", () => {
  const { r, g, b, l } = inspect(legibleWaveColor("#DD0000"));
  assert.ok(l >= 0.55 - EPS);
  assert.ok(r > g && r > b, "red should still dominate");
});

test("malformed input falls back to the brand flame", () => {
  assert.equal(legibleWaveColor("not-a-colour"), WAVE_FALLBACK.from);
  assert.equal(legibleWaveColor("#12"), WAVE_FALLBACK.from);
});

test("no match → brand flame→ocean fallback ends", () => {
  for (const w of [
    waveColorsForMatch(null, null),
    waveColorsForMatch(undefined, undefined),
  ]) {
    assert.equal(w.from, WAVE_FALLBACK.from);
    assert.equal(w.to, WAVE_FALLBACK.to);
    inspect(w.mid); // a valid colour
  }
});

test("a full matchup colours both ends from the flags", () => {
  // Brazil (green) at home, Argentina (light blue) away.
  const { from, to } = waveColorsForMatch("BRA", "ARG");
  assert.notEqual(from, to);
  const home = inspect(from);
  const away = inspect(to);
  assert.ok(home.g > home.r && home.g > home.b, "home should read green");
  assert.ok(away.b >= away.r && away.b >= away.g, "away should read blue");
});

test("distinct colours get a plain midpoint between the two ends", () => {
  const { from, mid, to } = waveColorsForMatch("BRA", "ARG");
  const lo = Math.min(inspect(from).l, inspect(to).l);
  const hi = Math.max(inspect(from).l, inspect(to).l);
  const m = inspect(mid).l;
  assert.ok(m >= lo - EPS && m <= hi + EPS, `midpoint ${m} not between ends`);
});

test("a same-colour matchup lifts the midpoint into a neutral crest", () => {
  // Belgium and Austria share #C8102E — the midpoint would be a flat red band.
  const { from, mid } = waveColorsForMatch("BEL", "AUT");
  const end = inspect(from);
  const crest = inspect(mid);
  assert.ok(crest.l > end.l + EPS, "crest should be lighter than the ends");
  assert.ok(crest.s < end.s, "crest should be less saturated (neutral)");
});

test("a missing side keeps the brand colour for that end", () => {
  assert.equal(waveColorsForMatch("BRA", null).to, WAVE_FALLBACK.to);
  assert.equal(waveColorsForMatch(null, "ARG").from, WAVE_FALLBACK.from);
});
