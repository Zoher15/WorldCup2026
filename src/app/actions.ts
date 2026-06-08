"use server";

import { getUserId } from "@/lib/identity";
import { getProfile, upsertProfile } from "@/lib/profile";
import { createGroupWithOwner, joinGroupByCode } from "@/lib/groups";
import type { LateJoinPolicy } from "@/lib/types";
import type { JoinState } from "./join-state";

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function fail(error: string): JoinState {
  return { status: "error", error };
}

/**
 * Ensure the signed-in user has a profile name (saved from the form's name
 * field, so the avatar + group display name work), and return the resolved
 * name. The profile row must exist before we add memberships that reference it.
 */
async function resolveName(userId: string, form: FormData): Promise<string> {
  const typed = field(form, "realName");
  const existing = await getProfile(userId);
  if (typed) {
    if (!existing || existing.name !== typed) await upsertProfile(userId, typed);
    return typed;
  }
  if (existing?.name) return existing.name;
  throw new Error("Please enter your name.");
}

export async function createGroupAction(
  _prev: JoinState,
  form: FormData,
): Promise<JoinState> {
  const userId = await getUserId();
  if (!userId) return fail("Please sign in first.");

  const groupName = field(form, "groupName");
  if (!groupName) return fail("Please give your group a name.");
  const lateJoinPolicy: LateJoinPolicy =
    field(form, "lateJoinPolicy") === "start_even" ? "start_even" : "carry_over";

  try {
    const name = await resolveName(userId, form);
    const displayName = field(form, "displayName") || name;
    const { code } = await createGroupWithOwner({
      userId,
      groupName,
      displayName,
      lateJoinPolicy,
    });
    return { status: "success", groupCode: code };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

export async function joinGroupAction(
  _prev: JoinState,
  form: FormData,
): Promise<JoinState> {
  const userId = await getUserId();
  if (!userId) return fail("Please sign in first.");

  const code = field(form, "groupCode");
  if (!code) return fail("Please enter the group code.");

  try {
    const name = await resolveName(userId, form);
    const displayName = field(form, "displayName") || name;
    const joined = await joinGroupByCode({ userId, code, displayName });
    return { status: "success", groupCode: joined.code };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}
