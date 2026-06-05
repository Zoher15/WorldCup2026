"use client";

/** A big, thumb-friendly +/- goal stepper used for entering predictions. */
export function Stepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const btn =
    "h-11 w-11 rounded-full text-xl font-bold grid place-items-center transition active:scale-90 disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="decrease"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className={`${btn} bg-stone-200 text-stone-700`}
      >
        −
      </button>
      <span className="w-8 text-center text-2xl font-extrabold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label="increase"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className={`${btn} bg-pitch text-white`}
      >
        +
      </button>
    </div>
  );
}
