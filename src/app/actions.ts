"use server";

import { getUserId, setUserId } from "@/lib/identity";
import {
  ensureUser,
  createGroupWithOwner,
  joinGroupByCode,
} from "@/lib/groups";
import type { LateJoinPolicy } from "@/lib/types";
import type { JoinState } from "./join-state";

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function fail(error: string): JoinState {
  return { status: "error", error };
}

export async function createGroupAction(
  _prev: JoinState,
  form: FormData,
): Promise<JoinState> {
  const realName = field(form, "realName");
  const groupName = field(form, "groupName");
  const displayName = field(form, "displayName") || realName;
  const lateJoinPolicy: LateJoinPolicy =
    field(form, "lateJoinPolicy") === "start_even" ? "start_even" : "carry_over";

  if (!realName) return fail("Please enter your name.");
  if (!groupName) return fail("Please give your group a name.");

  try {
    const user = await ensureUser(await getUserId(), realName);
    if (user.created) await setUserId(user.userId);
    const { code } = await createGroupWithOwner({
      userId: user.userId,
      groupName,
      displayName,
      lateJoinPolicy,
    });
    return { status: "success", groupCode: code, recoveryCode: user.recoveryCode };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

export async function joinGroupAction(
  _prev: JoinState,
  form: FormData,
): Promise<JoinState> {
  const realName = field(form, "realName");
  const code = field(form, "groupCode");
  const displayName = field(form, "displayName") || realName;

  if (!realName) return fail("Please enter your name.");
  if (!code) return fail("Please enter the group code.");

  try {
    const user = await ensureUser(await getUserId(), realName);
    if (user.created) await setUserId(user.userId);
    const joined = await joinGroupByCode({
      userId: user.userId,
      code,
      displayName,
    });
    return {
      status: "success",
      groupCode: joined.code,
      recoveryCode: user.recoveryCode,
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}
