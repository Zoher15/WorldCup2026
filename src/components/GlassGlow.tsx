"use client";

import { useEffect } from "react";

/**
 * Drives the "liquid glass" pointer effects so only the *frontmost* glass
 * surface under the pointer reacts — never its ancestors. (CSS `:hover`/
 * `:active` would light up every glass element in the stack, which is why a
 * tap on a podium bar used to ripple through the whole leaderboard.)
 *
 * A single delegated pointer listener hit-tests the paint stack with
 * `elementsFromPoint` and picks the first `.glass` it finds — the element most
 * in front, or the containing card if nothing nearer is glass. It then:
 *   - feeds the relative position into `--gx`/`--gy` + a `--g-on` flag for the
 *     specular sheen (see `.glass` in globals.css), and
 *   - toggles the `glass-press` class for the tactile press dip.
 * Mounted once globally — no per-component wiring.
 */
export function GlassGlow() {
  useEffect(() => {
    let hovered: HTMLElement | null = null;
    let pressed: HTMLElement | null = null;
    let raf = 0;
    let pending: { x: number; y: number } | null = null;

    // The first glass (or solid-chrome) element in the front-to-back paint
    // stack at this point. Chrome surfaces don't render the sheen (their solid
    // fill ignores the highlight vars) but share the tactile press dip.
    const frontGlass = (x: number, y: number): HTMLElement | null => {
      for (const node of document.elementsFromPoint(x, y)) {
        if (
          node instanceof HTMLElement &&
          (node.classList.contains("glass") || node.classList.contains("chrome"))
        ) {
          return node;
        }
      }
      return null;
    };

    // Fade the sheen out *in place*: only dim `--g-on` and leave `--gx`/`--gy`
    // alone. Removing the position vars would snap them back to their 50%/50%
    // default, so the highlight would flash to the centre while fading out.
    const clearHover = () => {
      if (!hovered) return;
      hovered.style.setProperty("--g-on", "0");
      hovered = null;
    };

    const releasePress = () => {
      if (!pressed) return;
      pressed.classList.remove("glass-press");
      pressed = null;
    };

    // Light the specular sheen on `el` at this point. Shared by the hover path
    // and the press path so a tap hit-tests the stack only once.
    const paintSheen = (el: HTMLElement, x: number, y: number) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--gx", `${((x - r.left) / r.width) * 100}%`);
      el.style.setProperty("--gy", `${((y - r.top) / r.height) * 100}%`);
      el.style.setProperty("--g-on", "1");
      hovered = el;
    };

    const apply = () => {
      raf = 0;
      if (!pending) return;
      const { x, y } = pending;
      const el = frontGlass(x, y);
      if (el !== hovered) clearHover();
      if (el) paintSheen(el, x, y);
    };

    const onMove = (e: PointerEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };

    // Hit-test the stack once and drive both the sheen and the press dip from
    // it — synchronously, so the tactile feedback lands on the same frame as the
    // tap (no waiting on the rAF-batched move path).
    const onDown = (e: PointerEvent) => {
      const el = frontGlass(e.clientX, e.clientY);
      if (el !== hovered) clearHover();
      if (el) paintSheen(el, e.clientX, e.clientY);
      if (el !== pressed) releasePress();
      if (el) {
        el.classList.add("glass-press");
        pressed = el;
      }
    };

    // A touch/pen lift ends the gesture (fade the sheen too); a mouse-button
    // release keeps the hover sheen, which the next move re-paints.
    const onUp = (e: PointerEvent) => {
      releasePress();
      if (e.pointerType !== "mouse") clearHover();
    };

    const onBlur = () => {
      releasePress();
      clearHover();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointercancel", onUp, { passive: true });
    window.addEventListener("blur", onBlur);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onBlur);
      releasePress();
      clearHover();
    };
  }, []);

  // Battery: freeze the always-on looping animations (the conic live-ring, the
  // pulses, the brand-gradient drift, the shimmer…) whenever the tab is hidden,
  // by toggling `data-anim-paused` on <body> — the matching `animation-play-state:
  // paused` rules live in globals.css. Pausing keeps each loop's phase, so they
  // resume seamlessly when the tab returns. Mounted here since GlassGlow is the
  // one component already present on every page.
  useEffect(() => {
    const sync = () => {
      document.body.toggleAttribute("data-anim-paused", document.hidden);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      document.body.removeAttribute("data-anim-paused");
    };
  }, []);

  return null;
}
