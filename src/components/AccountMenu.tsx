"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { signOutAction } from "@/app/auth/actions";
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
      <Link
        href="/login"
        className={`rounded-full glass px-4 py-1.5 text-sm font-bold text-grape dark:text-violet-300 ${FOCUS_RING}`}
      >
        Sign in
      </Link>
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
        <span className="grid h-9 w-9 place-items-center rounded-full glass text-sm font-black text-grape dark:text-violet-300">
          {initials}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-52 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5 dark:bg-stone-800 dark:ring-white/10">
          {name ? (
            <p className="truncate px-3 py-1.5 text-sm font-bold text-stone-700 dark:text-stone-100">
              {name}
            </p>
          ) : (
            <Link
              href="/welcome"
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-1.5 text-sm font-bold text-grape hover:bg-stone-100 dark:text-violet-300 dark:hover:bg-stone-700 ${FOCUS_RING}`}
            >
              Finish setup →
            </Link>
          )}

          <div className="my-1 border-t border-black/5 dark:border-white/10" />

          <Link
            href="/predict"
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-1.5 text-sm font-bold text-stone-700 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-700 ${FOCUS_RING}`}
          >
            ⚽ My predictions
          </Link>
          <Link
            href="/groups"
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-1.5 text-sm font-bold text-stone-700 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-700 ${FOCUS_RING}`}
          >
            🏆 My groups
          </Link>

          <div className="my-1 border-t border-black/5 dark:border-white/10" />

          <form action={signOutAction}>
            <button
              className={`w-full rounded-lg px-3 py-1.5 text-left text-sm font-bold text-flame hover:bg-stone-100 dark:hover:bg-stone-700 ${FOCUS_RING}`}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
