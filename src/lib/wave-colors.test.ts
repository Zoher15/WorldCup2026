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

test("the USA wave carries red, white AND blue", () => {
  const stops = teamWaveColors("USA").map(inspect);
  assert.ok(
    stops.some((c) => c.r > c.g && c.r > c.b),
    "expected a red stop",
  );
  assert.ok(
    stops.some((c) => c.l > 0.9 && c.s < 0.05),
    "expected a white stop",
  );
  assert.ok(
    stops.some((c) => c.b > c.r && c.b > c.g),
    "expected a blue stop",
  );
});

test("a matchup concatenates home then away flag colours", () => {
  const usa = teamWaveColors("USA");
  const bra = teamWaveColors("BRA");
  const stops = waveStopsForMatch("USA", "BRA");
  assert.ok(stops.length >= 4, "both palettes should contribute");
  assert.equal(stops[0], usa[0], "home's lead colour comes first");
  assert.ok(stops.some((c) => bra.includes(c)), "away colours appear too");
});

test("no match → brand flame→grape→ocean fallback", () => {
  assert.deepEqual(waveStopsForMatch(null, null), [...WAVE_FALLBACK]);
  assert.deepEqual(waveStopsForMatch(undefined, undefined), [...WAVE_FALLBACK]);
});

test("a lone known team still yields a usable sweep", () => {
  const stops = waveStopsForMatch("USA", null);
  assert.equal(stops[0], teamWaveColors("USA")[0]);
  assert.ok(stops.length >= 2, "a single side must still be a gradient");
});

test("an unknown code falls back without throwing", () => {
  // Knockout placeholder code: no flag palette, no team colour → neutral.
  const stops = waveStopsForMatch("W49", "L50");
  assert.ok(stops.length >= 2);
  for (const c of stops) inspect(c); // all valid colours
});
