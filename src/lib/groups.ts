import { createAdminClient } from "./supabase/admin";
import { generateGroupCode, generateRecoveryCode, normalizeCode } from "./codes";
import { buildStandings, type Standings } from "./standings";
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

export interface GroupStandings {
  group: {
    code: string;
    name: string;
    lateJoinPolicy: LateJoinPolicy;
    memberCount: number;
  };
  standings: Standings;
}

/** Load a group's live leaderboard, computed from confirmed results. */
export async function getGroupStandings(
  code: string,
): Promise<GroupStandings | null> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id, code, name, late_join_policy, created_at")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) return null;

  // Members and confirmed results are independent — fetch them in parallel.
  const [membersRes, matchesRes] = await Promise.all([
    db
      .from("memberships")
      .select("user_id, display_name, joined_at")
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

  return {
    group: {
      code: group.code,
      name: group.name,
      lateJoinPolicy: group.late_join_policy,
      memberCount: memberList.length,
    },
    standings,
  };
}
