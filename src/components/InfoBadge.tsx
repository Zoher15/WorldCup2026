"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { FOCUS_RING } from "./theme";
import { useDismissOnOutside } from "./useDismissOnOutside";

// Which edge the popover hangs from, so it stays inside its container instead of
// spilling past a narrow column (the podium steps) or the card's edge. Kept as
// complete static strings — Tailwind v4 scans source for class names and can't
// see ones assembled at runtime.
const ALIGN = {
  left: "left-0",
  center: "left-1/2 -translate-x-1/2",
  right: "right-0",
} as const;

/**
 * A badge whose meaning isn't obvious from its glyph alone — a streak flame, the
 * against-the-crowd crystal ball. Tapping it reveals a plain-language explainer;
 * tap again, tap outside, or press Escape to dismiss. A native `title` keeps the
 * hover hint working where there's room.
 *
 * The popover rides the heavier `glass-frost` (≈90% opaque) rather than the base
 * `.glass` (≈58%): the lighter frost lets the busy leaderboard rows and flag
 * colours bleed through and muddy the text, so the explainer needs the opaque
 * sheet to stay legible.
 */
export function InfoBadge({
  children,
  label,
  explainer,
  align = "left",
  triggerClassName = "",
}: {
  /** The always-visible glyph(s) inside the trigger, e.g. 🔥3 or 🔮. */
  children: ReactNode;
  /** Hover title / accessible description of what the badge means. */
  label: string;
  /** The popover body revealed on tap. */
  explainer: ReactNode;
  /** Edge the popover hangs from, so it stays inside its container. */
  align?: keyof typeof ALIGN;
  /** Extra classes for the trigger (colour, size, pill, font reset…). */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  // Dismiss on a tap/click anywhere outside the badge (or Escape), so the
  // popover doesn't linger once the reader has moved on.
  useDismissOnOutside(open, ref, useCallback(() => setOpen(false), []));
  return (
    <span ref={ref} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={label}
        className={`transition active:scale-95 ${FOCUS_RING} ${triggerClassName}`}
      >
        {children}
      </button>
      {open && (
        <div
          className={`absolute top-full z-20 mt-1 w-48 rounded-xl glass glass-frost px-3 py-2 text-left text-[11px] font-medium leading-snug text-stone-100 ${ALIGN[align]}`}
        >
          {explainer}
        </div>
      )}
    </span>
  );
}
