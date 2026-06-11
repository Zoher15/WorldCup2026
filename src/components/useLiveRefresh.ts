"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While `active` (any card on the page is live), re-fetch the server component
 * tree on a timer so live scores tick forward without a manual reload. The
 * server data is itself only ~1/min fresh (the poll cadence), so a coarse
 * interval is plenty; it pauses when the tab is hidden to avoid wasted work.
 */
export function useLiveRefresh(active: boolean, intervalMs = 45_000): void {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
}
