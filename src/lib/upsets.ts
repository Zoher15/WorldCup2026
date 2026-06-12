/**
 * Consensus upsets: a prediction is an "upset call" when the group largely
 * backed the wrong outcome and one or two people called it right against that
 * consensus. Pure — fed already-graded entries so it's easy to unit-test.
 *
 * "Called it right" means full outcome points (the 5 for the correct
 * direction, penalty-decided knockouts included, since grading maps those to
 * the team that advanced). The thresholds keep it meaningful in small family
 * groups while scaling to big ones:
 *   - at least 3 graded pickers (no consensus to defy otherwise),
 *   - at least 2 of them wrong,
 *   - the right-callers are a clear minority (at most a third).
 */

const FULL_OUTCOME_POINTS = 5;

export interface UpsetEntry {
  userId: string;
  /** Outcome points the pick earned (0, 2, or 5). */
  outcome: number;
  /** The baseline bot never counts toward (or against) the consensus. */
  isBot?: boolean;
}

export function upsetCallerIds(entries: UpsetEntry[]): Set<string> {
  const pickers = entries.filter((e) => !e.isBot);
  const correct = pickers.filter((e) => e.outcome >= FULL_OUTCOME_POINTS);
  const wrong = pickers.length - correct.length;
  if (
    pickers.length < 3 ||
    correct.length < 1 ||
    wrong < 2 ||
    correct.length / pickers.length > 1 / 3
  ) {
    return new Set();
  }
  return new Set(correct.map((e) => e.userId));
}
