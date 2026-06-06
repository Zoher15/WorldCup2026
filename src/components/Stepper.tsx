"use client";

const SIZES = {
  sm: { btn: "h-9 w-9 text-lg", value: "w-7 text-2xl" },
  md: { btn: "h-11 w-11 text-xl", value: "w-8 text-2xl" },
} as const;

/** A big, thumb-friendly +/- goal stepper used for entering predictions. */
export function Stepper({
  value,
  onChange,
  disabled,
  size = "md",
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  const btn = `${s.btn} rounded-full font-bold grid place-items-center transition active:scale-90`;
  // When the whole stepper is disabled it greys out entirely (a "not open" card);
  // when only "−" is disabled at zero it just dims.
  const plus = disabled
    ? `${btn} bg-stone-200 text-stone-400 dark:bg-stone-700 dark:text-stone-500`
    : `${btn} bg-pitch text-white`;
  const minus = disabled
    ? `${btn} bg-stone-200 text-stone-400 dark:bg-stone-700 dark:text-stone-500`
    : `${btn} bg-stone-200 text-stone-700 disabled:opacity-40 dark:bg-stone-700 dark:text-stone-200`;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="decrease"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className={minus}
      >
        −
      </button>
      <span
        className={`${s.value} text-center font-extrabold tabular-nums ${
          disabled ? "text-stone-400" : ""
        }`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="increase"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className={plus}
      >
        +
      </button>
    </div>
  );
}
