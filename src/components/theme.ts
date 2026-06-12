/**
 * Semantic text-colour pairings shared across the match displays, so e.g. "the
 * prediction colour" lives in one place.
 *
 * Tailwind v4 scans source files for class names, so these MUST remain
 * complete static strings — never assemble a class name dynamically.
 */

/** The player's call/pick (predictions). */
export const PREDICTION_TEXT = "text-grape dark:text-violet-300";

/** A settled result: full-time scores and the points they earned. */
export const RESULT_TEXT = "text-pitch dark:text-emerald-400";

/** Live, in-play scores and badges. */
export const LIVE_TEXT = "text-flame";

/** Keyboard-focus ring for interactive controls (buttons, steppers, tabs).
 *  Visible over the glass surfaces in both light and dark mode. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch dark:focus-visible:ring-emerald-400";
