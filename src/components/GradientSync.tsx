"use client";

import { useEffect } from "react";

/**
 * Brand-motion families pinned to ONE shared phase clock. Each entry is
 * `[selector, periodMs, property]`:
 *  - `periodMs` must match the animation duration in globals.css.
 *  - `property` carries the negative delay — the element's own `animation-delay`
 *    for the gradient wave, or the `--ring-delay` custom property that the
 *    `.live-ring::before` pseudo-element reads (you can't set a pseudo-element's
 *    delay inline, so it inherits the var from the host).
 *
 * The live-card glow rotates its hues every 14s — the same period as the brand
 * drift — so pinning both to the same epoch locks them 1:1: the glow, the home
 * hero title (.title-wave) and the hero ring all re-align every cycle. The glow
 * also paints the same matchup colours — the live/next-up teams' home→away flag
 * wave (see `--wave-stops` and `.live-ring` in globals.css), so the whole system
 * is one wave in both colour and phase.
 */
const TARGETS: ReadonlyArray<readonly [string, number, string]> = [
  [".title-wave, .gradient-accent", 14000, "animation-delay"],
  [".live-ring", 14000, "--ring-delay"],
];
const SELECTOR = TARGETS.map(([s]) => s).join(", ");

/**
 * Keeps every drifting/spinning brand element waving in one shared phase, so the
 * home hero title, the hero ring and the live match-card glow all move together —
 * no matter which page you're on or when an element mounts.
 *
 * Each animation's clock otherwise starts at its own mount, so a remounting hero
 * title and a persistent live card would drift apart. We pin each element to the
 * negative of the current position within its cycle (from the page's shared
 * `performance` epoch), so anything mounting at any moment snaps into the shared
 * phase.
 *
 * Mounted once globally. CSS still drives the animations, so without JS you only
 * lose the cross-element sync, not the motion.
 */
export function GradientSync() {
  useEffect(() => {
    // The CSS already disables these under reduced motion — nothing to sync.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const synced = new WeakSet<HTMLElement>();

    const syncEl = (el: HTMLElement) => {
      for (const [selector, period, prop] of TARGETS) {
        if (el.matches(selector)) {
          el.style.setProperty(prop, `-${performance.now() % period}ms`);
        }
      }
    };
    const syncWithin = (root: ParentNode, force = false) =>
      root.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (!force && synced.has(el)) return;
        syncEl(el);
        synced.add(el);
      });

    // Initial pass: the persistent wordmark/initials + whatever's on this page.
    syncWithin(document);

    // Catch elements added by client navigation / streamed content (new page
    // headings, a match flipping live). Only newly-seen ones are touched, so
    // persistent elements never re-seek and visibly snap. Batched per frame.
    let raf = 0;
    const pending = new Set<HTMLElement>();
    const flush = () => {
      raf = 0;
      pending.forEach((el) => {
        if (synced.has(el)) return;
        syncEl(el);
        synced.add(el);
      });
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
    // they trail the shared clock — realign everything to the current phase.
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
