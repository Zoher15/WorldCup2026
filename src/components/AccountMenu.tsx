"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { signOutAction } from "@/app/auth/actions";
import { Button } from "./Button";
import { FOCUS_RING } from "./theme";
import { useDismissOnOutside } from "./useDismissOnOutside";

/**
 * Top-right account indicator: a circular avatar with the user's initials and a
 * small dropdown (name + sign out). Shows a "Sign in" link when logged out.
 * Initials are computed server-side and passed in to keep this purely visual.
 */
export function AccountMenu({
  loggedIn,
  name,
  initials,
}: {
  loggedIn: boolean;
  name: string | null;
  initials: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click anywhere outside the menu, or on Escape.
  useDismissOnOutside(open, ref, useCallback(() => setOpen(false), []));

  if (!loggedIn) {
    return (
      <Button as="link" href="/login" tone="grape" size="sm">
        Sign in
      </Button>
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Padding widens the touch zone past 44px; the negative margin cancels
          it out visually so the header keeps its compact height. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`-m-1.5 flex cursor-pointer items-center rounded-full p-1.5 ${FOCUS_RING}`}
      >
        {/* The initials wear the same living matchup wave (home→away team
            colours) as the "World Cup 2026" wordmark, kept in phase by
            GradientSync, so the
            header is gradient on both ends. The gradient sits on an INNER span:
            `.glass` and `.gradient-text` both paint `background`, so putting both
            on one element clips the glass fill instead of the gradient and the
            transparent text-fill blanks the letters. The 🙂 no-name fallback
            stays solid violet (gradient-clipping would blank the emoji — the
            same reason the wordmark's ⚽ sits outside its gradient). */}
        <span className="grid h-9 w-9 place-items-center rounded-full glass text-sm font-black">
          <span className={name ? "gradient-text" : "text-violet-300"}>
            {initials}
          </span>
        </span>
      </button>

      {open && (
        <div className="glass glass-frost absolute right-0 z-30 mt-2 w-52 origin-top-right animate-pop-in rounded-2xl p-2 shadow-xl">
          {name ? (
            <p className="truncate px-3 py-1.5 text-sm font-bold text-stone-100">
              {name}
            </p>
          ) : (
            <Link
              href="/welcome"
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-1.5 text-sm font-bold text-violet-300 transition hover:bg-white/10 ${FOCUS_RING}`}
            >
              Finish setup →
            </Link>
          )}

          <div className="my-1 border-t border-white/10" />

          <Link
            href="/predict"
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-1.5 text-sm font-bold text-stone-100 transition hover:bg-white/10 ${FOCUS_RING}`}
          >
            ⚽ My predictions
          </Link>
          <Link
            href="/groups"
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-1.5 text-sm font-bold text-stone-100 transition hover:bg-white/10 ${FOCUS_RING}`}
          >
            🏆 My groups
          </Link>

          <div className="my-1 border-t border-white/10" />

          <form action={signOutAction}>
            <button
              className={`w-full rounded-lg px-3 py-1.5 text-left text-sm font-bold text-flame transition hover:bg-white/10 ${FOCUS_RING}`}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
