"use client";

import { useEffect, type RefObject } from "react";

/**
 * While `open`, dismiss a popover/menu when the user taps anywhere outside
 * `ref` or presses Escape. Shared by the InfoBadge explainer and the account
 * dropdown so the dismiss wiring lives in one place. Listeners only attach
 * while open, so a closed popover costs nothing.
 */
export function useDismissOnOutside(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, onDismiss]);
}
