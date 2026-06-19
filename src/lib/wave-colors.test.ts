import { test } from "node:test";
import assert from "node:assert/strict";
import {
  legibleWaveColor,
  teamWaveColors,
  waveStopsForMatch,
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

const EPS = 0.01;

test("lifts a deep navy into the legible band, keeping it blue", () => {
  // USA canton #1a305e is far too dark to read as clipped text on the dark UI.
  const { b, r, g, l } = inspect(legibleWaveColor("#1a305e"));
  assert.ok(l >= 0.52 - EPS, `lightness ${l} below floor`);
  assert.ok(l <= 0.85 + EPS, `lightness ${l} above ceiling`);
  assert.ok(b > r && b > g, "blue should still dominate");
});

test("keeps a flag's white as white, not a capped grey", () => {
  const { l, s } = inspect(legibleWaveColor("#ffffff"));
  assert.ok(l > 0.9, `white should stay light, got ${l}`);
  assert.ok(s < 0.05, "white should stay neutral");
});

test("lifts a flag's black into a visible neutral, not a hue", () => {
  // The extractor reports near-black as e.g. #000001; it must read as silver.
  const { l, s } = inspect(legibleWaveColor("#000001"));
  assert.ok(l >= 0.62 - EPS, `black should be floored to visible, got ${l}`);
  assert.ok(s < 0.05, "lifted black should be neutral, not a colour");
});

test("preserves a vivid red's hue while floored", () => {
  const { r, g, b, l } = inspect(legibleWaveColor("#bd3d44"));
  assert.ok(l >= 0.52 - EPS);
  assert.ok(r > g && r > b, "red should still dominate");
});

test("malformed input falls back to the brand flame", () => {
  assert.equal(legibleWaveColor("not-a-colour"), WAVE_FALLBACK[0]);
  assert.equal(legibleWaveColor("#12"), WAVE_FALLBACK[0]);
});

/** Parse a `#rrggbb p%` CSS stop into its colour and position. */
function parseStop(stop: string): { hex: string; pos: number } {
  const m = /^(#[0-9a-fA-F]{6}) (\d+(?:\.\d+)?)%$/.exec(stop);
  assert.ok(m, `bad stop: ${stop}`);
  return { hex: m![1], pos: parseFloat(m![2]) };
}

test("the USA wave carries red, white AND blue", () => {
  const cols = teamWaveColors("USA").map((s) => inspect(s.color));
  assert.ok(cols.some((c) => c.r > c.g && c.r > c.b), "expected a red stop");
  assert.ok(cols.some((c) => c.l > 0.9 && c.s < 0.05), "expected a white stop");
  assert.ok(cols.some((c) => c.b > c.r && c.b > c.g), "expected a blue stop");
});

test("flag colours are weighted by area, most-prominent first", () => {
  const stops = teamWaveColors("BRA");
  const total = stops.reduce((a, s) => a + s.weight, 0);
  // The generator rounds each share to 3 dp, so the sum can drift a hair off 1.
  assert.ok(Math.abs(total - 1) < 0.01, "weights should sum to ~1");
  assert.ok(stops[0].weight > 0.5, "Brazil's green field should dominate");
  for (let i = 1; i < stops.length; i++) {
    assert.ok(stops[i - 1].weight >= stops[i].weight, "ordered most-prominent first");
  }
});

test("a thin stripe gets a smaller band than a dominant field", () => {
  // Brazil: the green field (≈64%) should occupy far more of its half of the
  // wave than the blue circle (≈14%).
  const stops = waveStopsForMatch("BRA", null).map(parseStop);
  // Position span each colour 'owns' ≈ gap to its neighbours; compare the lead
  // (green) span to the last (blue) span via their stop spacing.
  const greenSpan = stops[1].pos - stops[0].pos;
  const blueSpan = 100 - stops[stops.length - 1].pos;
  assert.ok(greenSpan > blueSpan, "dominant colour should span wider");
});

test("a matchup gives each team half the wave", () => {
  const stops = waveStopsForMatch("USA", "BRA").map(parseStop);
  assert.equal(stops.length, 6, "both 3-colour flags contribute");
  // Positions strictly increase and stay in range.
  for (let i = 1; i < stops.length; i++) {
    assert.ok(stops[i].pos > stops[i - 1].pos, "positions increase");
  }
  assert.ok(stops[0].pos > 0 && stops[5].pos < 100);
  // Home colours sit in the left half, away in the right.
  assert.ok(stops[2].pos < 50, "last home colour is left of centre");
  assert.ok(stops[3].pos > 50, "first away colour is right of centre");
});

test("no match → brand flame→grape→ocean fallback", () => {
  for (const w of [waveStopsForMatch(null, null), waveStopsForMatch(undefined, undefined)]) {
    assert.deepEqual(
      w.map((s) => parseStop(s).hex),
      [...WAVE_FALLBACK],
    );
  }
});

test("a lone known team still yields a usable sweep", () => {
  const stops = waveStopsForMatch("USA", null);
  assert.ok(stops.length >= 2, "a single side must still be a gradient");
  assert.equal(parseStop(stops[0]).hex, teamWaveColors("USA")[0].color);
});

test("an unknown code falls back without throwing", () => {
  // Knockout placeholder code: no flag palette, no team colour → neutral.
  const stops = waveStopsForMatch("W49", "L50");
  assert.ok(stops.length >= 2);
  for (const s of stops) inspect(parseStop(s).hex); // all valid colours
});
