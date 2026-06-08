/**
 * Shared types/constants for the join + create-group flow.
 *
 * Kept OUT of `actions.ts` on purpose: that file is `"use server"`, and a
 * "use server" module may only export async functions — every export is turned
 * into a server-action reference. Exporting a plain object/type from there
 * breaks the client's action wiring, so these live in this ordinary module.
 */
export interface JoinState {
  status: "idle" | "error" | "success";
  error?: string;
  groupCode?: string;
  /** Shown once when a new account was created so the user can save it. */
  recoveryCode?: string | null;
}

export const INITIAL_JOIN_STATE: JoinState = { status: "idle" };
