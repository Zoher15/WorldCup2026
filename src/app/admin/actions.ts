"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdmin, signInAdmin, signOutAdmin } from "@/lib/admin-auth";
import { setMatchResult, clearMatchResult } from "@/lib/results";
import { isValidGoals } from "@/lib/prediction-rules";

export interface AdminLoginState {
  error?: string;
}

export async function adminLoginAction(
  _prev: AdminLoginState,
  form: FormData,
): Promise<AdminLoginState> {
  const ok = await signInAdmin(String(form.get("passcode") ?? ""));
  if (!ok) {
    return { error: "Incorrect passcode (or ADMIN_PASSCODE isn't set)." };
  }
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await signOutAdmin();
  redirect("/admin");
}

export interface ResultState {
  ok: boolean;
  error?: string;
}

export async function setResultAction(input: {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  advancedCode?: string | null;
}): Promise<ResultState> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  if (!isValidGoals(input.homeGoals, input.awayGoals)) {
    return { ok: false, error: "Enter a valid score (0–30)." };
  }
  try {
    await setMatchResult(input);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function clearResultAction(matchId: string): Promise<ResultState> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  try {
    await clearMatchResult(matchId);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
