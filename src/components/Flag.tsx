import { teamByCode } from "@/lib/fifa";

const SIZES = {
  sm: "w-7 h-5",
  md: "w-10 h-7",
  lg: "w-14 h-10",
} as const;

/**
 * Renders a crisp SVG flag for a FIFA team code. Falls back to a neutral globe
 * for unknown teams or knockout placeholders ("Winner Group A").
 */
export function Flag({
  code,
  size = "md",
  className = "",
}: {
  code: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const team = teamByCode(code);
  const box = SIZES[size];
  const shared = `${box} rounded-md shadow-sm ring-1 ring-black/10 overflow-hidden shrink-0`;

  if (!team) {
    return (
      <span
        className={`${shared} grid place-items-center bg-stone-200 text-stone-500 ${className}`}
        title="To be decided"
        aria-label="To be decided"
      >
        🏳️
      </span>
    );
  }

  return (
    <span
      className={`fi fi-${team.iso} ${shared} ${className}`}
      title={team.name}
      role="img"
      aria-label={team.name}
    />
  );
}
