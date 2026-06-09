"use client";

import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";

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
  if (!loggedIn) {
    return (
      <Link
        href="/login"
        className="rounded-full glass px-4 py-1.5 text-sm font-bold text-grape dark:text-violet-300"
      >
        Sign in
      </Link>
    );
  }

  return (
    <details className="relative [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-grape text-sm font-black text-white shadow ring-2 ring-white/70 dark:ring-stone-900/70">
          {initials}
        </span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-48 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5 dark:bg-stone-800 dark:ring-white/10">
        {name ? (
          <p className="truncate px-3 py-1.5 text-sm font-bold text-stone-700 dark:text-stone-100">
            {name}
          </p>
        ) : (
          <Link
            href="/join"
            className="block rounded-lg px-3 py-1.5 text-sm font-bold text-grape hover:bg-stone-100 dark:text-violet-300 dark:hover:bg-stone-700"
          >
            Finish setup →
          </Link>
        )}
        <form action={signOutAction}>
          <button className="w-full rounded-lg px-3 py-1.5 text-left text-sm font-bold text-flame hover:bg-stone-100 dark:hover:bg-stone-700">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
