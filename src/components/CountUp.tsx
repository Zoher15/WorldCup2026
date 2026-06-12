"use client";

import { useEffect, useState } from "react";

/**
 * Animates a number from 0 up to `value` over ~0.8s on first mount, with a
 * rAF-driven ease-out. Renders just the digits — width/weight/colour (and
 * `tabular-nums`, so the digits don't jiggle) come from the parent's classes.
 *
 * SSR-safe: the server render (and the first client render) shows the final
 * value, so there's no hydration mismatch and no JS-off/SEO regression; only
 * after mount does it rewind to 0 and count up. Under prefers-reduced-motion
 * the final value just stays put. After the animation, later `value` changes
 * (e.g. live refreshes) render directly without re-animating.
 */
export function CountUp({
  value,
  durationMs = 800,
}: {
  value: number;
  durationMs?: number;
}) {
  // Progress through the count-up: 1 = "show the final value" (the SSR and
  // post-animation state); the mount effect rewinds it to 0 and eases up.
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      setProgress(1 - Math.pow(1 - t, 3)); // ease-out cubic
      if (t < 1) raf = requestAnimationFrame(step);
    };
    setProgress(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // Mount-only by design: the celebration fires once per mount (page load /
    // card flip), never when props change mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{Math.round(progress * value)}</>;
}
