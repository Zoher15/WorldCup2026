import { formatKickoffDate } from "./format";

/**
 * Group kickoff-ordered matches under their (viewer-local) date headings,
 * preserving the input order — consecutive items sharing a date share a group.
 */
export function groupByDate<T extends { kickoffAt: string }>(
  items: T[],
): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const date = formatKickoffDate(item.kickoffAt);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(item);
    else groups.push({ date, items: [item] });
  }
  return groups;
}
