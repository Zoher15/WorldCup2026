/**
 * A tiny, dependency-free inline-SVG icon set. Every glyph is a stroked path
 * that inherits `currentColor`, so an icon takes the colour of whatever brand
 * token its parent carries (`text-flame`, `text-violet-300`, …) and renders
 * identically on every device — no emoji-font roulette where one platform's
 * 🔒 looks nothing like another's.
 *
 * Replaces the *structural* emoji that were standing in for UI icons (lock,
 * clock, map pin, share link, chevrons, movement arrows, medals, target). The
 * genuinely expressive emoji — 🎉 confetti, 🔥 streak, ⚽ wordmark, 🤖 bot,
 * 🔮 upset — stay as emoji on purpose; those carry voice, not structure.
 *
 * Usage: `<Icon name="lock" className="text-stone-300" />`. Size defaults to
 * 1em so the glyph tracks the surrounding text size; pass `size` to override.
 * Decorative by default (`aria-hidden`); pass a `title` to give it a label.
 */

import type { SVGProps } from "react";

export type IconName =
  | "lock"
  | "map-pin"
  | "clock"
  | "hourglass"
  | "link"
  | "chevron-up"
  | "chevron-down"
  | "chevron-right"
  | "arrow-up"
  | "arrow-down"
  | "medal"
  | "trophy"
  | "target";

type IconProps = {
  name: IconName;
  /** Pixel/length size; defaults to `1em` so it tracks the text size. */
  size?: number | string;
  /** An accessible label. When omitted the icon is `aria-hidden`. */
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "name">;

/**
 * Per-glyph SVG children, drawn on a 24×24 grid. Stroke-based where the shape
 * is a line drawing; the medal/trophy mix a filled core with stroked detail so
 * they still read as a solid badge at podium size.
 */
const PATHS: Record<IconName, React.ReactNode> = {
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // A waiting glass: top/bottom bars with curved sides pinching to a waist —
  // the "kicked off, score pending" marker.
  hourglass: (
    <>
      <path d="M7 4h10M7 20h10" />
      <path d="M7 4c0 4 5 5 5 8s-5 4-5 8" />
      <path d="M17 4c0 4-5 5-5 8s5 4 5 8" />
    </>
  ),
  link: (
    <>
      <path d="M9.5 14.5a3.5 3.5 0 0 1 0-5l2-2a3.5 3.5 0 0 1 5 5l-1 1" />
      <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5l-2 2a3.5 3.5 0 0 1-5-5l1-1" />
    </>
  ),
  "chevron-up": <path d="M6 14.5 12 8.5l6 6" />,
  "chevron-down": <path d="M6 9.5 12 15.5l6-6" />,
  "chevron-right": <path d="M9.5 6 15.5 12l-6 6" />,
  "arrow-up": (
    <>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </>
  ),
  "arrow-down": (
    <>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </>
  ),
  // A filled disc on a ribbon — reads as a solid medal at small and podium
  // sizes. The star is left as a stroked notch so it stays crisp.
  medal: (
    <>
      <path d="M8.5 3 6 8M15.5 3 18 8" />
      <circle cx="12" cy="14.5" r="6" fill="currentColor" stroke="none" />
      <path
        d="m12 11.3 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2L9 13.6l2.2-.3 1-2Z"
        fill="rgba(0,0,0,0.28)"
        stroke="none"
      />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" fill="currentColor" stroke="none" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 2.5M17 6h2.5a2.5 2.5 0 0 1-2.5 2.5" />
      <path d="M12 14v3M9 20h6M9.5 20c0-1.5 1-3 2.5-3s2.5 1.5 2.5 3" />
    </>
  ),
  // A bullseye for the exact-score / "outcome" UI marker.
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
};

export function Icon({ name, size = "1em", title, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      // Sit on the text baseline like a glyph rather than the default `inline`
      // bottom alignment, so an icon next to a word lines up with it.
      style={{ display: "inline-block", verticalAlign: "-0.125em", ...rest.style }}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
