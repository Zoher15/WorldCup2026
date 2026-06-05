import { createAdminClient } from "./supabase/admin";
import { generateGroupCode, generateRecoveryCode, normalizeCode } from "./codes";
import type { LateJoinPolicy } from "./types";

const UNIQUE_VIOLATION = "23505";

export interface EnsureUserResult {
  userId: string;
  /** Set only when a brand-new user was created (show it once, then it's gone). */
  recoveryCode: string | null;
  created: boolean;
}

/** Reuse the existing device identity, or create a new user with a recovery code. */
export async function ensureUser(
  existingId: string | null,
  realName: string,
): Promise<EnsureUserResult> {
  const db = createAdminClient();
  if (existingId) {
    await db.from("users").update({ real_name: realName }).eq("id", existingId);
    return { userId: existingId, recoveryCode: null, created: false };
  }
  const recoveryCode = generateRecoveryCode();
  const { data, error } = await db
    .from("users")
    .insert({ real_name: realName, recovery_code: recoveryCode })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Could not create your account: ${error?.message ?? "unknown error"}`);
  }
  return { userId: data.id, recoveryCode, created: true };
}

/** Create a group with a unique join code and add the owner as admin member. */
export async function createGroupWithOwner(opts: {
  userId: string;
  groupName: string;
  displayName: string;
  lateJoinPolicy: LateJoinPolicy;
}): Promise<{ code: string }> {
  const db = createAdminClient();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateGroupCode();
    const { data, error } = await db
      .from("groups")
      .insert({
        code,
        name: opts.groupName,
        late_join_policy: opts.lateJoinPolicy,
        created_by: opts.userId,
      })
      .select("id")
      .single();
    if (!error && data) {
      const { error: mErr } = await db.from("memberships").insert({
        user_id: opts.userId,
        group_id: data.id,
        display_name: opts.displayName,
        is_admin: true,
      });
      if (mErr) throw new Error(`Could not add you to the group: ${mErr.message}`);
      return { code };
    }
    if (error && error.code !== UNIQUE_VIOLATION) {
      throw new Error(`Could not create the group: ${error.message}`);
    }
    // otherwise the random code collided — try again
  }
  throw new Error("Could not allocate a unique group code, please try again.");
}

/** Join an existing group by its code (idempotent on repeat joins). */
export async function joinGroupByCode(opts: {
  userId: string;
  code: string;
  displayName: string;
}): Promise<{ code: string }> {
  const db = createAdminClient();
  const code = normalizeCode(opts.code);
  const { data: group, error } = await db
    .from("groups")
    .select("id, code")
    .eq("code", code)
    .single();
  if (error || !group) {
    throw new Error("No group found with that code. Double-check it and try again.");
  }
  const { error: mErr } = await db
    .from("memberships")
    .upsert(
      { user_id: opts.userId, group_id: group.id, display_name: opts.displayName },
      { onConflict: "user_id,group_id" },
    );
  if (mErr) throw new Error(`Could not join the group: ${mErr.message}`);
  return { code: group.code };
}

export interface GroupView {
  group: { id: string; code: string; name: string; lateJoinPolicy: LateJoinPolicy };
  members: { displayName: string; isAdmin: boolean }[];
}

/** Read a group and its members for display. Returns null if no such code. */
export async function getGroupView(code: string): Promise<GroupView | null> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id, code, name, late_join_policy")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) return null;
  const { data: members } = await db
    .from("memberships")
    .select("display_name, is_admin, joined_at")
    .eq("group_id", group.id)
    .order("joined_at", { ascending: true });
  return {
    group: {
      id: group.id,
      code: group.code,
      name: group.name,
      lateJoinPolicy: group.late_join_policy,
    },
    members: (members ?? []).map((m) => ({
      displayName: m.display_name,
      isAdmin: m.is_admin,
    })),
  };
}
