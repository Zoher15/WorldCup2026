import Link from "next/link";
import { FOCUS_RING } from "./theme";

/**
 * The single page wrapper for the app's screens — one place that owns the
 * container width, the side gutter and the vertical rhythm, so pages stop
 * drifting between `max-w-5xl`/`max-w-3xl`/`max-w-md` and `py-8/10/12/16`.
 *
 * - `width` picks the content measure (the home dashboard is `wide`, most
 *   reading/leaderboard pages are `content`, auth/onboarding forms are
 *   `narrow`). The header in layout.tsx aligns to the same `wide` token.
 * - The vertical rhythm is a single `py-8` for every page (no more drift).
 * - `back` renders the standardized "← Label" affordance pages used to hand-roll.
 * - `bottomInset` reserves clearance for the fixed bottom bars: `"nav"` clears
 *   the mobile tab bar (every signed-in screen), `"nav-savebar"` also clears the
 *   predict save bar. Defaults to `"nav"`; pass `"none"` for the rare screen with
 *   no bottom bar (e.g. signed-out flows can still keep it — the nav routes them
 *   to login). The matching CSS vars/utilities live in globals.css.
 *
 * Tailwind v4 scans source for class names, so the width/inset values are
 * complete static strings selected by a lookup — never assembled at runtime.
 */

const WIDTHS = {
  wide: "max-w-5xl",
  content: "max-w-3xl",
  narrow: "max-w-md",
} as const;

export type PageWidth = keyof typeof WIDTHS;

const BOTTOM_INSETS = {
  nav: "pb-nav",
  "nav-savebar": "pb-nav-savebar",
  none: "pb-8",
} as const;

export type PageBottomInset = keyof typeof BOTTOM_INSETS;

export function PageShell({
  width = "content",
  back,
  bottomInset = "nav",
  className = "",
  children,
}: {
  width?: PageWidth;
  /** Optional standardized back link rendered above the page content. */
  back?: { href: string; label: string };
  bottomInset?: PageBottomInset;
  /** Extra classes for the <main> (rarely needed). */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className={`mx-auto px-4 pt-8 ${WIDTHS[width]} ${BOTTOM_INSETS[bottomInset]} ${className}`.trim()}
    >
      {back && (
        <Link
          href={back.href}
          className={`mb-3 inline-block rounded-md text-sm font-bold text-stone-400 ${FOCUS_RING}`}
        >
          ← {back.label}
        </Link>
      )}
      {children}
    </main>
  );
}
