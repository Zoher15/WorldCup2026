import { createAdminClient } from "./supabase/admin";
import { generateGroupCode, normalizeCode } from "./codes";
import { buildStandings, type Standings } from "./standings";
import type { LateJoinPolicy } from "./types";

const UNIQUE_VIOLATION = "23505";

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

export interface UserGroup {
  code: string;
  name: string;
  memberCount: number;
}

/** Every group the user belongs to, with member counts, for their groups list. */
export async function getUserGroups(userId: string): Promise<UserGroup[]> {
  const db = createAdminClient();
  const { data: mine } = await db
    .from("memberships")
    .select("group_id")
    .eq("user_id", userId);
  const groupIds = (mine ?? []).map((m) => m.group_id);
  if (groupIds.length === 0) return [];

  const [{ data: groups }, { data: members }] = await Promise.all([
    db.from("groups").select("id, code, name").in("id", groupIds),
    db.from("memberships").select("group_id").in("group_id", groupIds),
  ]);

  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
  }

  return (groups ?? []).map((g) => ({
    code: g.code,
    name: g.name,
    memberCount: counts.get(g.id) ?? 0,
  }));
}

export interface GroupStandings {
  group: {
    code: string;
    name: string;
    lateJoinPolicy: LateJoinPolicy;
    memberCount: number;
    creatorId: string | null;
  };
  /** The requesting user's relationship to this group. */
  viewer: { isMember: boolean; isAdmin: boolean };
  standings: Standings;
}

/** Load a group's live leaderboard, computed from confirmed results. */
export async function getGroupStandings(
  code: string,
  viewerId?: string | null,
): Promise<GroupStandings | null> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id, code, name, late_join_policy, created_at, created_by")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) return null;

  // Members and confirmed results are independent — fetch them in parallel.
  const [membersRes, matchesRes] = await Promise.all([
    db
      .from("memberships")
      .select("user_id, display_name, joined_at, is_admin")
      .eq("group_id", group.id),
    db
      .from("matches")
      .select("id, kickoff_at, stage, home_goals, away_goals, advanced_code, result_confirmed")
      .eq("result_confirmed", true),
  ]);
  const memberList = membersRes.data ?? [];
  const userIds = memberList.map((m) => m.user_id);
  const matchList = matchesRes.data ?? [];

  let predList: {
    user_id: string;
    match_id: string;
    pred_home: number;
    pred_away: number;
    advance_pick: string | null;
  }[] = [];
  if (userIds.length && matchList.length) {
    const { data: preds } = await db
      .from("predictions")
      .select("user_id, match_id, pred_home, pred_away, advance_pick")
      .in("user_id", userIds)
      .in("match_id", matchList.map((m) => m.id));
    predList = preds ?? [];
  }

  const standings = buildStandings({
    members: memberList.map((m) => ({
      userId: m.user_id,
      displayName: m.display_name,
      joinedAt: m.joined_at,
    })),
    matches: matchList.map((m) => ({
      id: m.id,
      kickoffAt: m.kickoff_at,
      stage: m.stage,
      resultConfirmed: m.result_confirmed,
      homeGoals: m.home_goals,
      awayGoals: m.away_goals,
      advancedCode: m.advanced_code,
    })),
    predictions: predList.map((p) => ({
      userId: p.user_id,
      matchId: p.match_id,
      predHome: p.pred_home,
      predAway: p.pred_away,
      advancePick: p.advance_pick,
    })),
    lateJoinPolicy: group.late_join_policy,
    groupCreatedAt: group.created_at,
  });

  const myMembership = viewerId
    ? memberList.find((m) => m.user_id === viewerId)
    : undefined;
  const isMember = Boolean(myMembership);
  const isAdmin =
    isMember &&
    (Boolean(myMembership?.is_admin) || group.created_by === viewerId);

  return {
    group: {
      code: group.code,
      name: group.name,
      lateJoinPolicy: group.late_join_policy,
      memberCount: memberList.length,
      creatorId: group.created_by,
    },
    viewer: { isMember, isAdmin },
    standings,
  };
}

/** The viewer's membership in a group, without computing standings. */
export async function getViewerMembership(
  code: string,
  userId: string,
): Promise<{ isMember: boolean; isAdmin: boolean }> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id, created_by")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) return { isMember: false, isAdmin: false };
  const { data: m } = await db
    .from("memberships")
    .select("is_admin")
    .eq("group_id", group.id)
    .eq("user_id", userId)
    .single();
  if (!m) return { isMember: false, isAdmin: false };
  return {
    isMember: true,
    isAdmin: Boolean(m.is_admin) || group.created_by === userId,
  };
}

/** Verify a user may administer the group; returns the group's id. */
async function assertGroupAdmin(
  db: ReturnType<typeof createAdminClient>,
  code: string,
  userId: string,
): Promise<{ groupId: string; creatorId: string | null }> {
  const { data: group } = await db
    .from("groups")
    .select("id, created_by")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) throw new Error("Group not found.");
  if (group.created_by !== userId) {
    const { data: m } = await db
      .from("memberships")
      .select("is_admin")
      .eq("group_id", group.id)
      .eq("user_id", userId)
      .single();
    if (!m?.is_admin) throw new Error("Only the group's admin can do that.");
  }
  return { groupId: group.id, creatorId: group.created_by };
}

/** Delete a group (and its memberships, by cascade). Admin only. */
export async function deleteGroup(code: string, userId: string): Promise<void> {
  const db = createAdminClient();
  const { groupId } = await assertGroupAdmin(db, code, userId);
  const { error } = await db.from("groups").delete().eq("id", groupId);
  if (error) throw new Error(`Could not delete the group: ${error.message}`);
}

/** Remove a member from a group. Admin only; the creator can't be removed. */
export async function removeMember(
  code: string,
  adminUserId: string,
  targetUserId: string,
): Promise<void> {
  const db = createAdminClient();
  const { groupId, creatorId } = await assertGroupAdmin(db, code, adminUserId);
  if (targetUserId === creatorId) {
    throw new Error("The group creator can't be removed.");
  }
  const { error } = await db
    .from("memberships")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", targetUserId);
  if (error) throw new Error(`Could not remove the member: ${error.message}`);
}
