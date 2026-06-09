"use client";

const SIZES = {
  sm: { btn: "h-9 w-9 text-lg", value: "w-7 text-2xl" },
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
  const btn = `${s.btn} rounded-full font-bold grid place-items-center transition active:scale-90`;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="decrease"
        disabled={value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className={`${btn} glass text-stone-700 disabled:opacity-40 dark:text-stone-200`}
      >
        −
      </button>
      <span className={`${s.value} text-center font-extrabold tabular-nums`}>
        {value}
      </span>
      <button
        type="button"
        aria-label="increase"
        onClick={() => onChange(value + 1)}
        className={`${btn} glass text-pitch dark:text-emerald-400`}
      >
        +
      </button>
    </div>
  );
}
