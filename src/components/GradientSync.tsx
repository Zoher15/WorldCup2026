"use client";

import { useEffect } from "react";

/** Must match the `gradient-drift` duration in globals.css. */
const PERIOD_MS = 14000;
const SELECTOR = ".gradient-text, .gradient-accent";

/**
 * Keeps every drifting brand gradient — the top-left wordmark, page headings,
 * the hero card ring, the active leaderboard tab — waving in ONE shared phase,
 * so the World Cup wordmark always matches the page heading no matter which page
 * you're on.
 *
 * Each `.gradient-text`/`.gradient-accent` runs its own `gradient-drift`
 * animation whose clock starts when that element mounts. The layout wordmark
 * persists across navigation, but page headings remount and restart their wave
 * from zero, so they drift out of phase. We pin each element's `animation-delay`
 * to the negative of the current position within the cycle (measured from the
 * page's shared `performance` epoch), so an element mounting at any moment snaps
 * into the same phase as every other.
 *
 * Mounted once globally (no per-element wiring). CSS still drives the animation,
 * so without JS you simply lose the cross-element sync, not the gradient.
 */
export function GradientSync() {
  useEffect(() => {
    // The CSS already disables the drift under reduced motion — nothing to sync.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const synced = new WeakSet<HTMLElement>();
    const phase = () => `-${performance.now() % PERIOD_MS}ms`;

    const sync = (el: HTMLElement, force = false) => {
      if (!force && synced.has(el)) return;
      el.style.animationDelay = phase();
      synced.add(el);
    };
    const syncWithin = (root: ParentNode, force = false) =>
      root
        .querySelectorAll<HTMLElement>(SELECTOR)
        .forEach((el) => sync(el, force));

    // Initial pass: the persistent wordmark + whatever's on the first page.
    syncWithin(document);

    // Catch gradients added by client navigation / streamed content (new page
    // headings). Only newly-seen elements are touched, so persistent ones never
    // re-seek and visibly snap. Batched into a frame to stay cheap on busy DOMs.
    let raf = 0;
    const pending = new Set<HTMLElement>();
    const flush = () => {
      raf = 0;
      pending.forEach((el) => sync(el));
      pending.clear();
    };
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(SELECTOR)) pending.add(node);
          node
            .querySelectorAll<HTMLElement>(SELECTOR)
            .forEach((el) => pending.add(el));
        }
      }
      if (pending.size && !raf) raf = requestAnimationFrame(flush);
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // While the tab is hidden the loops freeze (data-anim-paused), so on return
    // they trail the shared clock — realign every gradient to the current phase.
    const onVisible = () => {
      if (!document.hidden) syncWithin(document, true);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      obs.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
