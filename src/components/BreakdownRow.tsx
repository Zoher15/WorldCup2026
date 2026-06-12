/** One line of the points math: a label and the points it contributed. */
export function BreakdownRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px] font-bold">
      <span className="text-stone-500 dark:text-stone-300">{label}</span>
      <span className="tabular-nums text-stone-700 dark:text-stone-100">
        +{value}
        {max != null && (
          <span className="text-stone-400 dark:text-stone-500"> / {max}</span>
        )}
      </span>
    </div>
  );
}
