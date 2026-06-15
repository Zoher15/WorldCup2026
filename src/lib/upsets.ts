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
 *
 * computeNewUpsets rolls these per-match calls up across a member's groups for
 * the match-day digest's achievements block.
 */

import { computeBreakdown } from "./score-breakdown.ts";
import type { Stage } from "./types.ts";

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

// ── Per-recipient upset roll-up (for the match-day digest) ───────────────────

/** A settled match to scan for upset calls, teams already resolved to a label. */
export interface UpsetMatch {
  id: string;
  /** Kickoff (epoch ms), so the newest call can lead. */
  kickoffMs: number;
  /** The fixture label, e.g. "Brazil vs Spain". */
  label: string;
  stage: Stage;
  homeCode: string | null;
  awayCode: string | null;
  /** The confirmed full-time result the picks are graded against. */
  result: { home: number; away: number; advancedCode: string | null };
}

/** One member's scoreline pick for a match. */
export interface UpsetPick {
  home: number;
  away: number;
  advancePick: string | null;
}

/** One "against the crowd" call to celebrate for a recipient. */
export interface UpsetCall {
  /** Match id — dedupes a call that defied several of the recipient's groups. */
  matchId: string;
  /** The fixture label, e.g. "Brazil vs Spain". */
  match: string;
  /** A group whose consensus they defied (one, even if it was several). */
  group: string;
  /** Kickoff (epoch ms), so the newest call leads. */
  kickoffMs: number;
}

/**
 * Roll up every member's "against the crowd" calls across all groups: for each
 * settled match, grade each group's members with the same computeBreakdown used
 * on the per-match board, run the same upsetCallerIds consensus rule, and credit
 * the callers. A call that defied several of one member's groups is recorded
 * once (the first group encountered wins) so it reads as a single achievement.
 * Pure — fed already-loaded rows so it's unit-testable. Each member's calls come
 * back newest-first.
 */
export function computeNewUpsets(
  matches: UpsetMatch[],
  picksByMatch: Map<string, Map<string, UpsetPick>>,
  membersByGroup: Map<string, Set<string>>,
  groupName: Map<string, string>,
): Map<string, UpsetCall[]> {
  const byUser = new Map<string, UpsetCall[]>();
  for (const match of matches) {
    const picks = picksByMatch.get(match.id);
    if (!picks) continue;
    for (const [gid, members] of membersByGroup) {
      const entries: UpsetEntry[] = [];
      for (const uid of members) {
        const pick = picks.get(uid);
        if (!pick) continue;
        const { outcome } = computeBreakdown({
          pick: { home: pick.home, away: pick.away, advancePick: pick.advancePick },
          result: match.result,
          stage: match.stage,
          homeCode: match.homeCode,
          awayCode: match.awayCode,
        });
        entries.push({ userId: uid, outcome });
      }
      const callers = upsetCallerIds(entries);
      if (callers.size === 0) continue;
      const name = groupName.get(gid) ?? "your group";
      for (const uid of callers) {
        const arr = byUser.get(uid) ?? [];
        byUser.set(uid, arr);
        // One line per match per member — a call that defied several of their
        // groups still reads as a single achievement.
        if (!arr.some((c) => c.matchId === match.id)) {
          arr.push({ matchId: match.id, match: match.label, group: name, kickoffMs: match.kickoffMs });
        }
      }
    }
  }
  for (const arr of byUser.values()) arr.sort((a, b) => b.kickoffMs - a.kickoffMs);
  return byUser;
}
