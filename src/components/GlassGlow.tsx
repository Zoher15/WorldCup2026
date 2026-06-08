"use client";

import { useEffect } from "react";

/**
 * Drives the "liquid glass" specular highlight: a single delegated pointer
 * listener finds the `.glass` element under the cursor/finger and feeds the
 * relative position into CSS custom properties (`--gx`, `--gy`) plus a
 * `--g-on` flag. The `.glass` rule paints a soft radial sheen at that point
 * (see globals.css), so the light appears to follow the pointer across every
 * glass surface. Mounted once globally — no per-component wiring needed.
 */
export function GlassGlow() {
  useEffect(() => {
    let current: HTMLElement | null = null;
    let raf = 0;
    let pending: { x: number; y: number; target: EventTarget | null } | null = null;

    const clear = () => {
      if (!current) return;
      current.style.removeProperty("--gx");
      current.style.removeProperty("--gy");
      current.style.removeProperty("--g-on");
      current = null;
    };

    const apply = () => {
      raf = 0;
      if (!pending) return;
      const { x, y, target } = pending;
      const el =
        target instanceof Element
          ? (target.closest(".glass") as HTMLElement | null)
          : null;
      if (el !== current) clear();
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--gx", `${((x - r.left) / r.width) * 100}%`);
      el.style.setProperty("--gy", `${((y - r.top) / r.height) * 100}%`);
      el.style.setProperty("--g-on", "1");
      current = el;
    };

    const onMove = (e: PointerEvent) => {
      pending = { x: e.clientX, y: e.clientY, target: e.target };
      if (!raf) raf = requestAnimationFrame(apply);
    };

    // A touch/pen lift ends the gesture, so fade the sheen out. A mouse button
    // release shouldn't — the cursor is still hovering — so the next move
    // re-paints it.
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") clear();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onMove, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointercancel", onUp, { passive: true });
    window.addEventListener("blur", clear);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, []);

  return null;
}
