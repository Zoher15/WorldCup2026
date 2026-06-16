/** Shared Tailwind classes for the app's text inputs and their labels.
 *  (Tailwind v4 scans source for class names, so every class stays a complete
 *  static string inside these constants.)
 *
 *  The app is dark-mode only (`@custom-variant dark (&)` in globals.css), so
 *  the fields are styled dark directly — no light/`dark:` pairs that could
 *  flash a white field if the variant ever failed to apply. */

import { FOCUS_RING } from "./theme";

const inputBase =
  "w-full rounded-xl border border-stone-600 bg-stone-800 px-4 py-3 font-medium text-stone-100 outline-none placeholder:text-stone-500";

/** Auth / group text inputs: pitch (green) focus accent. */
export const inputClasses = `${inputBase} text-base focus:border-pitch focus:ring-2 focus:ring-pitch/50`;

/** Admin inputs: same field, grape (purple) focus accent. */
export const inputClassesGrape = `${inputBase} focus:border-grape focus:ring-2 focus:ring-grape/50`;

/** A compact admin input that shares the field's border / surface / focus
 *  tokens but drops the full-width + heavy padding — for the inline score boxes
 *  on the results page. Width/extra classes are supplied per use. */
export const inputCompactGrape =
  "rounded-lg border border-stone-600 bg-stone-800 text-stone-100 outline-none placeholder:text-stone-500 focus:border-grape focus:ring-2 focus:ring-grape/50";

export const labelClasses = "mb-1 block text-sm font-bold text-stone-200";

/**
 * The shared "chrome" control treatment for buttons and button-styled links —
 * the solid second material (see `.chrome` in globals.css), the keyboard focus
 * ring, and the tactile press dip (`active:scale-95`, paired with the global
 * GlassGlow press handler). One place so later work can migrate the ~15 glass
 * buttons onto a single consistent control.
 *
 * Tailwind v4 scans source for class names, so every tone/shape/size value is a
 * complete static string here — never assembled from fragments at runtime.
 */

/** Text-colour accents, matching the semantic palette used across the app. */
export const BUTTON_TONES = {
  pitch: "text-emerald-400",
  grape: "text-violet-300",
  ocean: "text-sky-400",
  neutral: "text-stone-100",
  /** Muted neutral, for low-emphasis controls (e.g. "Sign out", "Clear"). */
  muted: "text-stone-200",
  /** Destructive / urgent actions — leave, remove, delete. */
  flame: "text-flame",
} as const;

export type ButtonTone = keyof typeof BUTTON_TONES;

/** Shape: pill (the app's default control), or a softer rounded control. */
export const BUTTON_SHAPES = {
  pill: "rounded-full",
  control: "rounded-xl",
} as const;

export type ButtonShape = keyof typeof BUTTON_SHAPES;

/** Padding/size steps, kept in line with the existing hand-rolled buttons. */
export const BUTTON_SIZES = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
} as const;

export type ButtonSize = keyof typeof BUTTON_SIZES;

/** Build the full class string for a chrome control. */
export function buttonClasses({
  tone = "pitch",
  shape = "pill",
  size = "md",
  className = "",
}: {
  tone?: ButtonTone;
  shape?: ButtonShape;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return [
    BUTTON_SHAPES[shape],
    "chrome",
    BUTTON_SIZES[size],
    "font-bold",
    BUTTON_TONES[tone],
    "transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
    FOCUS_RING,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
