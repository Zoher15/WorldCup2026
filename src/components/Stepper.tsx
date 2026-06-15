"use client";

import { useEffect, useRef } from "react";
import { FOCUS_RING } from "./theme";

const SIZES = {
  // Even "small" keeps a 40px button so prediction-card steppers stay tappable.
  sm: { btn: "h-10 w-10 text-lg", value: "w-7 text-2xl" },
  md: { btn: "h-11 w-11 text-xl", value: "w-8 text-2xl" },
} as const;

/** A big, thumb-friendly +/- goal stepper used for entering predictions. */
export function Stepper({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (n: number) => void;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  const btn = `${s.btn} rounded-full font-bold grid place-items-center transition active:scale-90 ${FOCUS_RING}`;
  // Only pop the digit once we're past the first paint, so a predict page full
  // of steppers doesn't pop in unison on load — just on real taps thereafter.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Decrease score"
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className={`${btn} chrome text-stone-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-200`}
      >
        −
      </button>
      <span
        key={value}
        className={`${s.value} text-center font-extrabold tabular-nums ${mounted.current ? "digit-bump" : ""}`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase score"
        onClick={() => onChange(value + 1)}
        className={`${btn} chrome text-pitch dark:text-emerald-400`}
      >
        +
      </button>
    </div>
  );
}
