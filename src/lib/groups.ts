import { createAdminClient } from "./supabase/admin";
import { generateGroupCode, normalizeCode } from "./codes";
import {
  buildStandings,
  BORINGBOT_ID,
  BORINGBOT_NAME,
  type Standings,
} from "./standings";
import { isTrialActive } from "./prediction-rules";
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
      // Render the group's share image up front so its link unfurls immediately.
      // The share endpoint falls back to the default until this lands.
      await warmGroupOgImage(code);
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

  // A new member (or a rename via the upsert) changes the board, so warm the
  // share image now — it unfurls fresh on the first share rather than rendering
  // lazily. warmGroupOgImage no-ops when the hash is unchanged (e.g. an
  // idempotent re-join), and any failure self-heals on the next view.
  await warmGroupOgImage(group.code);

  return { code: group.code };
}

/**
 * Best-effort, fire-on-write refresh of a group's share image. Dynamically
 * imported (avoids an import cycle and keeps the next/og renderer off this
 * module's load path) and swallows failures — the /s/<code>/og endpoint serves
 * the default and self-heals on the next view.
 */
async function warmGroupOgImage(code: string): Promise<void> {
  try {
    const { ensureGroupOgImage } = await import("./og-images");
    await ensureGroupOgImage(code);
  } catch {
    // ignore — the /s/<code>/og endpoint refreshes it on the next view
  }
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

/**
 * The groups the viewer and another player BOTH belong to — the intersection of
 * their memberships. This is the privacy boundary for the cross-group player
 * hub: we only ever surface a player through groups the viewer is also in.
 */
export async function getSharedGroups(
  viewerId: string,
  targetUserId: string,
): Promise<UserGroup[]> {
  const db = createAdminClient();
  const [{ data: mine }, { data: theirs }] = await Promise.all([
    db.from("memberships").select("group_id").eq("user_id", viewerId),
    db.from("memberships").select("group_id").eq("user_id", targetUserId),
  ]);
  const theirSet = new Set((theirs ?? []).map((m) => m.group_id));
  const sharedIds = (mine ?? [])
    .map((m) => m.group_id)
    .filter((id) => theirSet.has(id));
  if (sharedIds.length === 0) return [];

  const [{ data: groups }, { data: members }] = await Promise.all([
    db.from("groups").select("id, code, name").in("id", sharedIds),
    db.from("memberships").select("group_id").in("group_id", sharedIds),
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

export interface CrossGroupPlayerGroup {
  code: string;
  name: string;
  /** The player's alias in THIS group (can differ across groups). */
  displayName: string;
  /** 1-based standing in the group's overall board (standard competition rank). */
  rank: number;
  points: number;
  /** Number of competitors on the board (incl. the baseline bot). */
  total: number;
  /** True while an in-play match is moving this group's board. */
  live: boolean;
}

export interface CrossGroupPlayer {
  player: { displayName: string; isViewer: boolean; isBot: boolean };
  /** One summary per shared group: the player's rank + points there. */
  groups: CrossGroupPlayerGroup[];
}

/**
 * A player across every group the viewer shares with them: their rank and points
 * in each, reusing the exact standings shown on the group page. Lightweight by
 * design — it surfaces standings, not each group's full prediction list.
 */
export async function getCrossGroupPlayer(opts: {
  viewerId: string;
  targetUserId: string;
}): Promise<CrossGroupPlayer> {
  const isBot = opts.targetUserId === BORINGBOT_ID;
  const isViewer = opts.viewerId === opts.targetUserId && !isBot;
  const shared = await getSharedGroups(opts.viewerId, opts.targetUserId);
  if (shared.length === 0) {
    return {
      player: { displayName: isBot ? BORINGBOT_NAME : "", isViewer, isBot },
      groups: [],
    };
  }

  const standingsList = await Promise.all(
    shared.map((g) => getGroupStandings(g.code, opts.viewerId)),
  );

  let headerName = "";
  const groups: CrossGroupPlayerGroup[] = [];
  for (let i = 0; i < shared.length; i++) {
    const s = standingsList[i];
    if (!s) continue;
    const board = s.standings.overall;
    const row = board.find((r) => r.userId === opts.targetUserId);
    if (!row) continue; // not on this board (e.g. removed) — skip
    // Standard competition ranking: one more than the number strictly ahead.
    const rank = board.filter((r) => r.points > row.points).length + 1;
    headerName ||= row.displayName;
    groups.push({
      code: shared[i].code,
      name: shared[i].name,
      displayName: row.displayName,
      rank,
      points: row.points,
      total: board.length,
      live: s.live,
    });
  }

  return {
    player: {
      displayName: isBot ? BORINGBOT_NAME : headerName,
      isViewer,
      isBot,
    },
    groups,
  };
}

export interface ViewerStanding {
  /** The group the viewer ranks best in (their headline standing). */
  code: string;
  name: string;
  /** 1-based standard competition rank in that group's overall board. */
  rank: number;
  /** Competitors on the board (incl. the baseline bot). */
  total: number;
  points: number;
  /** True while an in-play match is moving that board. */
  live: boolean;
  /** The one-line "you vs them" motivator, mirroring Leaderboard.tsx: crown on
   *  top, "tied with …", else "N pts behind …". Null if it can't be derived. */
  delta: string | null;
}

/**
 * The viewer's single best standing across all their groups — the "rank-first"
 * strip that leads the mobile home dashboard. Composes the existing standings
 * pipeline (getGroupStandings) and reuses Leaderboard.tsx's viewer-delta logic
 * rather than duplicating either; returns null when the viewer is in no group
 * with a board yet. */
export async function getViewerStanding(
  userId: string,
): Promise<ViewerStanding | null> {
  const mine = await getUserGroups(userId);
  if (mine.length === 0) return null;

  const standingsList = await Promise.all(
    mine.map((g) => getGroupStandings(g.code, userId)),
  );

  let best: ViewerStanding | null = null;
  for (let i = 0; i < mine.length; i++) {
    const s = standingsList[i];
    if (!s) continue;
    const board = s.standings.overall;
    const idx = board.findIndex((r) => r.userId === userId);
    if (idx < 0) continue;
    const minePts = board[idx].points;
    // Standard competition rank: one more than the number strictly ahead.
    const rank = board.filter((r) => r.points > minePts).length + 1;

    // Same "you vs them" line the leaderboard shows on the viewer's row.
    let delta: string | null = null;
    const tiedOthers = board.filter(
      (r, j) => j !== idx && r.points === minePts,
    );
    if (tiedOthers.length > 0) {
      const lead = rank === 1 ? "Tied for the lead with" : "Tied with";
      delta =
        tiedOthers.length === 1
          ? `${lead} ${tiedOthers[0].displayName}`
          : `${lead} ${tiedOthers.length} others`;
    } else if (rank === 1) {
      delta = "👑 Top of the group";
    } else {
      const ahead = board[idx - 1];
      const gap = ahead.points - minePts;
      delta = `${gap} pt${gap === 1 ? "" : "s"} behind ${ahead.displayName}`;
    }

    const candidate: ViewerStanding = {
      code: mine[i].code,
      name: mine[i].name,
      rank,
      total: board.length,
      points: minePts,
      live: s.live,
      delta,
    };
    // "Best" = lowest rank number; ties broken by more points, then more
    // competitors beaten (a #1 of 12 beats a #1 of 3).
    if (
      !best ||
      candidate.rank < best.rank ||
      (candidate.rank === best.rank && candidate.points > best.points) ||
      (candidate.rank === best.rank &&
        candidate.points === best.points &&
        candidate.total > best.total)
    ) {
      best = candidate;
    }
  }

  return best;
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
  /** True while an in-play match is being counted provisionally, so the board
   *  can show a LIVE cue and refresh itself. */
  live: boolean;
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
      .select("id, kickoff_at, stage, home_code, away_code, home_goals, away_goals, advanced_code, result_confirmed, status, is_trial")
      // Confirmed results, plus in-play/just-finished matches so live scores
      // count provisionally on the board (the auto-confirm settles them at FT).
      .or("result_confirmed.eq.true,status.eq.live,status.eq.finished"),
  ]);
  const memberList = membersRes.data ?? [];
  const userIds = memberList.map((m) => m.user_id);
  const matchList = matchesRes.data ?? [];

  // A group's predictions number members × matches, which crosses PostgREST's
  // default 1000-row response cap for a large group (e.g. 21 members over a full
  // tournament). An un-paginated read would silently drop the tail, zeroing out
  // whichever members' picks fell past row 1000 on the board — so page through
  // until a short page, ordered stably so the boundaries are deterministic.
  let predList: {
    user_id: string;
    match_id: string;
    pred_home: number;
    pred_away: number;
    advance_pick: string | null;
  }[] = [];
  if (userIds.length && matchList.length) {
    const matchIds = matchList.map((m) => m.id);
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: preds } = await db
        .from("predictions")
        .select("user_id, match_id, pred_home, pred_away, advance_pick")
        .in("user_id", userIds)
        .in("match_id", matchIds)
        .order("user_id", { ascending: true })
        .order("match_id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (!preds || preds.length === 0) break;
      predList.push(...preds);
      if (preds.length < PAGE) break;
    }
  }

  // An in-play / just-finished match with a score, not yet officially confirmed:
  // counted provisionally so the board moves live.
  const isProvisional = (m: (typeof matchList)[number]): boolean =>
    !m.result_confirmed &&
    (m.status === "live" || m.status === "finished") &&
    m.home_goals != null &&
    m.away_goals != null;

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
      homeCode: m.home_code,
      awayCode: m.away_code,
      isTrial: m.is_trial,
      live: isProvisional(m),
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
    includeBaseline: true,
    countTrialMatches: isTrialActive(),
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
    live: matchList.some(isProvisional),
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

/** A group's name by code (no auth needed) — used for invite link previews. */
export async function getGroupName(code: string): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("groups")
    .select("name")
    .eq("code", normalizeCode(code))
    .single();
  return data?.name ?? null;
}

/** Group name + whether the viewer already belongs, for the invite-accept page. */
export async function getGroupInvite(
  code: string,
  userId: string,
): Promise<{ name: string; isMember: boolean } | null> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id, name")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) return null;
  const { data: m } = await db
    .from("memberships")
    .select("user_id")
    .eq("group_id", group.id)
    .eq("user_id", userId)
    .single();
  return { name: group.name, isMember: Boolean(m) };
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

/** Rename a group. Admin only. */
export async function renameGroup(
  code: string,
  userId: string,
  newName: string,
): Promise<void> {
  const name = newName.trim();
  if (!name) throw new Error("Please enter a group name.");
  if (name.length > 80) {
    throw new Error("Group name is too long (80 characters max).");
  }
  const db = createAdminClient();
  const { groupId } = await assertGroupAdmin(db, code, userId);
  const { error } = await db.from("groups").update({ name }).eq("id", groupId);
  if (error) throw new Error(`Could not rename the group: ${error.message}`);
}

/** Leave a group. Any member except the creator, who must delete it instead. */
export async function leaveGroup(code: string, userId: string): Promise<void> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id, created_by")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) throw new Error("Group not found.");
  if (group.created_by === userId) {
    throw new Error("The group creator can't leave — delete the group instead.");
  }
  const { error } = await db
    .from("memberships")
    .delete()
    .eq("group_id", group.id)
    .eq("user_id", userId);
  if (error) throw new Error(`Could not leave the group: ${error.message}`);
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
