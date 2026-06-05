/**
 * Domain types mirroring the database schema (see supabase/migrations).
 * Kept hand-written and minimal; generated Supabase types can replace these
 * once the project is wired up.
 */

export type Stage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export type LateJoinPolicy = "carry_over" | "start_even";

export interface User {
  id: string;
  /** Real name — consistent across every group. */
  realName: string;
  recoveryCode: string | null;
  createdAt: string;
}

export interface Group {
  id: string;
  code: string;
  name: string;
  lateJoinPolicy: LateJoinPolicy;
  createdBy: string | null;
  createdAt: string;
}

export interface Membership {
  id: string;
  userId: string;
  groupId: string;
  /** Fun per-group alias shown on that group's leaderboard. */
  displayName: string;
  isAdmin: boolean;
  joinedAt: string;
}

export interface Match {
  id: string;
  externalRef: string | null;
  matchNumber: number | null;
  stage: Stage;
  groupLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeCode: string | null;
  awayCode: string | null;
  kickoffAt: string;
  venue: string | null;
  status: MatchStatus;
  minute: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  advancedCode: string | null;
  resultConfirmed: boolean;
  lastSyncedAt: string | null;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  predHome: number;
  predAway: number;
  advancePick: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchScoreRow {
  predictionId: string;
  outcomePoints: number;
  closenessPoints: number;
  advancePoints: number;
  totalPoints: number;
  computedAt: string;
}
