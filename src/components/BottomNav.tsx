"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FOCUS_RING } from "./theme";

/**
 * Persistent mobile tab bar (`md:hidden`) — the app's primary navigation on
 * phones, where Predict/Groups used to hide inside the account-menu dropdown.
 * Fixed to the bottom and sitting *below* the predict save bar (the save bar
 * floats at `bottom: var(--bottom-nav-h)`); page bottom-padding clears both via
 * the `.pb-nav` / `.pb-nav-savebar` utilities (see globals.css).
 *
 * Signed out, the auth-only tabs (Predict, Profile) degrade gracefully: they
 * point at the login page with a `next` back to where they were headed, so the
 * bar stays useful instead of disappearing.
 *
 * Icons are dependency-free inline SVGs defined locally (Track B's Icon.tsx
 * isn't in this branch), sized to a 24px box and inheriting `currentColor`.
 */

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
function PredictIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function GroupsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

export function BottomNav({
  loggedIn,
  userId,
}: {
  loggedIn: boolean;
  /** The signed-in user's id, so Profile can deep-link to their cross-group hub. */
  userId?: string | null;
}) {
  const pathname = usePathname();

  // Auth-only tabs route to login (with a return path) when signed out, so the
  // bar never dead-ends a guest.
  const loginTo = (next: string) =>
    `/login?next=${encodeURIComponent(next)}`;

  const profileHref = loggedIn && userId ? `/p/${userId}` : null;

  const tabs: {
    href: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
  }[] = [
    {
      href: "/",
      label: "Home",
      icon: <HomeIcon />,
      active: pathname === "/",
    },
    {
      href: loggedIn ? "/predict" : loginTo("/predict"),
      label: "Predict",
      icon: <PredictIcon />,
      active: pathname.startsWith("/predict"),
    },
    {
      href: loggedIn ? "/groups" : loginTo("/groups"),
      label: "Groups",
      icon: <GroupsIcon />,
      // Group screens live under /g/* too; treat those as the Groups tab.
      active: pathname.startsWith("/groups") || pathname.startsWith("/g/"),
    },
    {
      href: profileHref ?? loginTo("/groups"),
      label: "Profile",
      icon: <ProfileIcon />,
      active: profileHref != null && pathname.startsWith("/p/"),
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="glass glass-frost fixed inset-x-0 bottom-0 z-30 flex md:hidden"
      // Keep the tab row above the iOS home indicator.
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {tabs.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-bold transition ${FOCUS_RING} ${
            t.active
              ? "text-emerald-400"
              : "text-stone-400 hover:text-stone-100"
          }`}
        >
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
