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

    // The first glass element in the front-to-back paint stack at this point.
    const frontGlass = (x: number, y: number): HTMLElement | null => {
      for (const node of document.elementsFromPoint(x, y)) {
        if (node instanceof HTMLElement && node.classList.contains("glass")) {
          return node;
        }
      }
      return null;
    };

    const clearHover = () => {
      if (!hovered) return;
      hovered.style.removeProperty("--gx");
      hovered.style.removeProperty("--gy");
      hovered.style.removeProperty("--g-on");
      hovered = null;
    };

    const releasePress = () => {
      if (!pressed) return;
      pressed.classList.remove("glass-press");
      pressed = null;
    };

    const apply = () => {
      raf = 0;
      if (!pending) return;
      const { x, y } = pending;
      const el = frontGlass(x, y);
      if (el !== hovered) clearHover();
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--gx", `${((x - r.left) / r.width) * 100}%`);
      el.style.setProperty("--gy", `${((y - r.top) / r.height) * 100}%`);
      el.style.setProperty("--g-on", "1");
      hovered = el;
    };

    const onMove = (e: PointerEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onDown = (e: PointerEvent) => {
      onMove(e); // refresh the sheen position immediately
      const el = frontGlass(e.clientX, e.clientY);
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

  return null;
}
