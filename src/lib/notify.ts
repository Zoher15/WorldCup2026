/**
 * The match-day digest email.
 *
 * ONE cron-driven, self-throttling send: about an hour before a match-day's
 * FIRST kickoff, every opted-in member gets a single consolidated email that
 * folds in everything that used to be two separate sends —
 *   - the day's matches, with the recipient's picks marked,
 *   - which of them the recipient still hasn't predicted,
 *   - how far they've climbed in each group, plus per-group social proof
 *     ("9 of 9 of your group-mates are already in") for a nudge of FOMO, and
 *   - a celebratory achievements block: their current 🔥 scoring streak and any
 *     fresh 🔮 "against the crowd" calls settled since the last digest.
 * Firing an hour out (rather than at window-open, ~1.5 days early) means members
 * have had the whole window to play, so the "still missing", climb and FOMO
 * numbers are meaningful. The match-day is claimed in notified_match_days (PK
 * insert) before sending, so overlapping cron ticks send each day's digest
 * exactly once. The emails are enqueued into the shared email_queue and
 * delivered by its rate-limited drainer — see email-queue.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { dueMatchDaysForDigest } from "./notify-windows";
import {
  buildStandings,
  competitionRanks,
  BORINGBOT_ID,
  type StandingMember,
  type StandingMatch,
  type StandingPrediction,
} from "./standings";
import { isTrialActive } from "./prediction-rules";
import { teamLabel } from "./fifa";
import { formatStageLabel } from "./format";
import {
  computeNewUpsets,
  type UpsetCall,
  type UpsetMatch,
  type UpsetPick,
} from "./upsets";
import { isEmailConfigured, type EmailMessage } from "./email";
import { enqueueDigestEmails } from "./email-queue";
import { appBaseUrl } from "./app-url";
import type { LateJoinPolicy, Stage } from "./types";

interface MatchRow {
  id: string;
  kickoff_at: string;
  stage: Stage;
  group_label: string | null;
  home_code: string | null;
  away_code: string | null;
  home_team: string | null;
  away_team: string | null;
}

interface Recipient {
  userId: string;
  email: string;
  token: string;
}

export interface NotifyResult {
  ok: boolean;
  matchDay: string | null;
  recipients: number;
  queued: number;
  skipped?: string;
}

const MATCH_COLUMNS =
  "id, kickoff_at, stage, group_label, home_code, away_code, home_team, away_team";

/** How far before a match-day's FIRST kickoff the digest fires. */
const DIGEST_LEAD_MS = 1 * 60 * 60 * 1000;

/** How many fresh "against the crowd" calls the achievements block lists
 *  (newest first) before it stops — enough to celebrate without burying the
 *  call-to-action. */
const MAX_DIGEST_UPSETS = 3;

/**
 * Send the once-per-match-day digest: about an hour before a day's first
 * kickoff, enqueue ONE consolidated email per opted-in member — the day's
 * matches with their picks marked, what they're still missing, how far they've
 * climbed, and per-group FOMO. The match-day is claimed in notified_match_days
 * before enqueuing, so a coarse cron interval is fine and every day's digest is
 * enqueued exactly once.
 */
export async function sendMatchDayDigest(
  now: Date = new Date(),
): Promise<NotifyResult> {
  if (!isEmailConfigured()) {
    return { ok: true, matchDay: null, recipients: 0, queued: 0, skipped: "email not configured" };
  }

  const db = createAdminClient();

  const { data: matchData } = await db
    .from("matches")
    .select(MATCH_COLUMNS)
    .eq("is_trial", false);
  const matches = (matchData ?? []) as MatchRow[];

  // Match-days whose first kickoff is within the lead window (about to begin),
  // earliest first. Usually one at a time, but two can overlap (a late day and
  // the next day's early one), so we claim each in turn.
  const due = dueMatchDaysForDigest(matches, now, DIGEST_LEAD_MS);
  if (due.length === 0) {
    return { ok: true, matchDay: null, recipients: 0, queued: 0, skipped: "no match-day kicking off soon" };
  }

  // Claim the earliest due day we haven't already sent. Claiming each in turn —
  // rather than bailing on the earliest — means a second due day still gets its
  // digest on a later tick (within its own lead window). The PK insert makes the
  // claim exactly-once.
  let matchDay: string | null = null;
  let dueMatches: MatchRow[] = [];
  for (const day of due) {
    const { error: claimErr } = await db
      .from("notified_match_days")
      .insert({ match_day: day.matchDay });
    if (claimErr) continue; // already sent — try the next due day
    matchDay = day.matchDay;
    dueMatches = day.matches;
    break;
  }
  if (matchDay == null) {
    return { ok: true, matchDay: null, recipients: 0, queued: 0, skipped: "all due match-days already sent" };
  }

  // We've claimed the day; if the build throws before anything is enqueued,
  // release the claim so a later tick retries rather than leaving the digest
  // permanently unsent.
  try {
    const dayMatchIds = dueMatches.map((m) => m.id);
    // Who has predicted which of the day's games — for each recipient's "still
    // missing" list and the group FOMO counts. A failed read must NOT look like
    // "nobody predicted", so release the claim and bail to retry.
    const predicted = await loadPredictedByUser(db, dayMatchIds);
    if (!predicted) {
      await db.from("notified_match_days").delete().eq("match_day", matchDay);
      return { ok: true, matchDay: null, recipients: 0, queued: 0, skipped: "prediction read failed" };
    }
    // Anyone with ≥1 pick among the day's games counts as "in" for the stats.
    const participants = new Set(predicted.keys());

    const groups = await loadGroupStructure(db);
    const recipients = await loadRecipients(db);
    const base = appBaseUrl();
    const ordered = [...dueMatches].sort(
      (a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at),
    );

    // Per-group leaderboard movement since the last digest (the "you've climbed
    // N spots" line), plus the celebratory achievements — each member's current
    // scoring streak and any fresh "against the crowd" calls. Best-effort: if the
    // standings computation fails, the digest still goes out without these.
    let currentRanks = new Map<string, Map<string, number>>();
    let previousRanks = new Map<string, Map<string, number>>();
    let streakByUser = new Map<string, number>();
    let upsetsByUser = new Map<string, UpsetCall[]>();
    try {
      const ranks = await loadGroupRanks(db);
      currentRanks = ranks.ranks;
      streakByUser = ranks.streakByUser;
      previousRanks = await loadRankSnapshots(db);
      // "New since last digest" rides the climb's baseline: the first digest for a
      // league has no prior snapshot, so (like the climb) it surfaces no upsets
      // yet — only matches settled between consecutive digests are "new".
      const lastDigestAt = await loadLastDigestAt(db);
      if (lastDigestAt != null) {
        upsetsByUser = await loadNewUpsets(db, groups, lastDigestAt);
      }
    } catch {
      currentRanks = new Map();
      previousRanks = new Map();
      streakByUser = new Map();
      upsetsByUser = new Map();
    }

    // One digest per member: the full slate (with their picks marked), what's
    // still missing, how far they've climbed in each group, and how many
    // group-mates are already in.
    const messages: EmailMessage[] = recipients.map((r) => {
      const done = predicted.get(r.userId) ?? new Set<string>();
      const missing = ordered.filter((m) => !done.has(m.id));
      const stats = groupStatsFor(r.userId, groups, participants);
      const climbs = computeClimbs(r.userId, groups, currentRanks, previousRanks);
      const streak = streakByUser.get(r.userId) ?? 0;
      const upsets = upsetsByUser.get(r.userId) ?? [];
      return {
        to: r.email,
        subject: digestSubject(ordered.length, missing.length),
        html: renderDigestEmail(ordered, done, climbs, streak, upsets, stats, base, r.token),
        headers: { "List-Unsubscribe": `<${base}/unsubscribe?token=${r.token}>` },
      };
    });

    const queued = await enqueueDigestEmails(messages);
    await db.from("notified_match_days").update({ recipients: queued }).eq("match_day", matchDay);

    // Advance the rank baseline so the NEXT digest measures movement from here.
    if (currentRanks.size > 0) {
      try {
        await saveRankSnapshots(db, currentRanks, matchDay);
      } catch {
        // Best-effort — a failed snapshot just means the next digest diffs
        // against the older baseline (slightly larger climb numbers), never wrong
        // direction.
      }
    }

    return { ok: true, matchDay, recipients: messages.length, queued };
  } catch (e) {
    await db.from("notified_match_days").delete().eq("match_day", matchDay);
    throw e;
  }
}

/** Subject line, tuned for the ~1h-before-kickoff send: nudge on what's still
 *  missing, congratulate those who are done. */
function digestSubject(total: number, missing: number): string {
  if (missing === 0) {
    return `✅ You're all set for today's ${total} match${total === 1 ? "" : "es"}`;
  }
  if (missing < total) {
    return `⏳ ${missing} prediction${missing === 1 ? "" : "s"} left before kickoff`;
  }
  return `⏳ ${total} match${total === 1 ? "" : "es"} kick off soon — get your predictions in`;
}

/** One group the recipient is in: how many OTHER members are already in. */
interface GroupStat {
  name: string;
  /** Other members (excluding the recipient) who've predicted ≥1 of the day. */
  predicted: number;
  /** Total other members in the group (excludes the recipient). */
  others: number;
}

/**
 * The recipient's groups, each with "X of Y other members already predicted",
 * strongest-FOMO first. Solo groups (no other members) and groups where NObody
 * else is in yet are dropped — neither carries social proof, and "0 of 5 in" only
 * reassures a laggard. The denominator excludes the recipient on purpose, so a
 * fully-in group reads as "everyone else is already in".
 */
function groupStatsFor(
  userId: string,
  groups: GroupStructure,
  participants: Set<string>,
): GroupStat[] {
  const stats: GroupStat[] = [];
  for (const gid of groups.groupsByUser.get(userId) ?? []) {
    const members = groups.membersByGroup.get(gid);
    if (!members) continue;
    let others = 0;
    let predictedOthers = 0;
    for (const m of members) {
      if (m === userId) continue;
      others++;
      if (participants.has(m)) predictedOthers++;
    }
    if (others === 0) continue; // solo group — nothing to compare against
    if (predictedOthers === 0) continue; // nobody else in yet — no FOMO to show
    stats.push({
      name: groups.groupName.get(gid) ?? "your group",
      predicted: predictedOthers,
      others,
    });
  }
  // Lead with the strongest FOMO: most group-mates in, then the biggest group.
  stats.sort((a, b) => b.predicted - a.predicted || b.others - a.others);
  return stats;
}

/**
 * user_id -> set of predicted match_ids, for the given matches. Returns null if
 * the read errors (so callers don't mistake a failure for "nobody predicted").
 * Paged so a busy slate can't be silently truncated by a row cap.
 */
async function loadPredictedByUser(
  db: SupabaseClient,
  matchIds: string[],
): Promise<Map<string, Set<string>> | null> {
  const byUser = new Map<string, Set<string>>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("predictions")
      .select("user_id, match_id")
      .in("match_id", matchIds)
      .range(from, from + PAGE - 1);
    if (error) return null;
    for (const p of data ?? []) {
      const uid = p.user_id as string;
      const set = byUser.get(uid) ?? new Set<string>();
      set.add(p.match_id as string);
      byUser.set(uid, set);
    }
    if (!data || data.length < PAGE) break;
  }
  return byUser;
}

/** Everyone in at least one group, with an email, who hasn't opted out. */
async function loadRecipients(db: SupabaseClient): Promise<Recipient[]> {
  const memberIds = await loadMemberIds(db);
  if (memberIds.length === 0) return [];

  const prefById = await loadPrefs(db, memberIds);
  const emailById = await loadEmails(db);

  const out: Recipient[] = [];
  for (const id of memberIds) {
    const pref = prefById.get(id);
    const email = emailById.get(id);
    if (!pref || pref.optOut || !email) continue;
    out.push({ userId: id, email, token: pref.token });
  }
  return out;
}

/** Distinct user ids across all memberships, paged past any row cap. */
async function loadMemberIds(db: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("memberships")
      .select("user_id")
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const m of data) ids.add(m.user_id as string);
    if (data.length < PAGE) break;
  }
  return [...ids];
}

interface Pref {
  optOut: boolean;
  token: string;
}

/** Email opt-out + unsubscribe token per user, fetched in chunks of ids. */
async function loadPrefs(db: SupabaseClient, memberIds: string[]): Promise<Map<string, Pref>> {
  const map = new Map<string, Pref>();
  const CHUNK = 1000; // keep the IN list (and URL) bounded
  for (let i = 0; i < memberIds.length; i += CHUNK) {
    const slice = memberIds.slice(i, i + CHUNK);
    const { data } = await db
      .from("users")
      .select("id, email_opt_out, unsubscribe_token")
      .in("id", slice);
    for (const p of data ?? []) {
      map.set(p.id as string, {
        optOut: Boolean(p.email_opt_out),
        token: p.unsubscribe_token as string,
      });
    }
  }
  return map;
}

/** Map of auth user id -> email, paged through Supabase Auth. */
async function loadEmails(db: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) if (u.email) map.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }
  return map;
}

interface GroupStructure {
  /** group id -> set of its member user ids. */
  membersByGroup: Map<string, Set<string>>;
  /** user id -> the group ids they belong to. */
  groupsByUser: Map<string, string[]>;
  /** group id -> display name. */
  groupName: Map<string, string>;
}

/**
 * The full membership graph plus group names, for the per-group FOMO counts.
 * Paged past Supabase's row cap so a large league isn't silently truncated.
 */
async function loadGroupStructure(db: SupabaseClient): Promise<GroupStructure> {
  const membersByGroup = new Map<string, Set<string>>();
  const groupsByUser = new Map<string, string[]>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("memberships")
      .select("user_id, group_id")
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const row of data) {
      const gid = row.group_id as string;
      const uid = row.user_id as string;
      let set = membersByGroup.get(gid);
      if (!set) {
        set = new Set<string>();
        membersByGroup.set(gid, set);
      }
      set.add(uid);
      const arr = groupsByUser.get(uid);
      if (arr) arr.push(gid);
      else groupsByUser.set(uid, [gid]);
    }
    if (data.length < PAGE) break;
  }

  const groupName = new Map<string, string>();
  const ids = [...membersByGroup.keys()];
  const CHUNK = 1000; // keep the IN list bounded
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data } = await db.from("groups").select("id, name").in("id", slice);
    for (const g of data ?? []) groupName.set(g.id as string, g.name as string);
  }
  return { membersByGroup, groupsByUser, groupName };
}

/** One group the recipient has climbed in since the last digest. */
interface Climb {
  name: string;
  /** Positions gained (always ≥ 1 — flat or dropping groups aren't shown). */
  spots: number;
}

/**
 * The recipient's positive rank movements since the last digest, biggest climb
 * first. Only groups where we have BOTH a prior snapshot and a current rank, and
 * where they moved UP, are included — this is encouragement, so a drop or no
 * change is simply omitted. Ranks are the overall-board position (ties shared).
 */
function computeClimbs(
  userId: string,
  groups: GroupStructure,
  current: Map<string, Map<string, number>>,
  previous: Map<string, Map<string, number>>,
): Climb[] {
  const climbs: Climb[] = [];
  for (const gid of groups.groupsByUser.get(userId) ?? []) {
    const curr = current.get(gid)?.get(userId);
    const prev = previous.get(gid)?.get(userId);
    if (curr == null || prev == null) continue;
    const spots = prev - curr; // smaller rank number = higher position
    if (spots > 0) {
      climbs.push({ name: groups.groupName.get(gid) ?? "your group", spots });
    }
  }
  climbs.sort((a, b) => b.spots - a.spots);
  return climbs;
}

const SCORABLE_MATCH_COLUMNS =
  "id, kickoff_at, stage, home_code, away_code, home_goals, away_goals, advanced_code, result_confirmed, status, is_trial";

interface ScorableMatchRow {
  id: string;
  kickoff_at: string;
  stage: Stage;
  home_code: string | null;
  away_code: string | null;
  home_goals: number | null;
  away_goals: number | null;
  advanced_code: string | null;
  result_confirmed: boolean;
  status: string;
  is_trial: boolean;
}

/**
 * Every member's CURRENT overall-board rank in each group, as group id -> (user
 * id -> rank), plus each member's best scoring streak across their groups (for
 * the achievements block). Computed with the same engine and inputs the app's
 * leaderboards use (BoringBot baseline included, trial matches honored), so the
 * numbers match what members see. All loads are paged so a large league isn't
 * truncated.
 */
async function loadGroupRanks(
  db: SupabaseClient,
): Promise<{
  ranks: Map<string, Map<string, number>>;
  streakByUser: Map<string, number>;
}> {
  // Group scoring metadata.
  const groupsMeta = new Map<string, { lateJoinPolicy: LateJoinPolicy; createdAt: string }>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("groups")
      .select("id, late_join_policy, created_at")
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const g of data) {
      groupsMeta.set(g.id as string, {
        lateJoinPolicy: g.late_join_policy as LateJoinPolicy,
        createdAt: g.created_at as string,
      });
    }
    if (data.length < PAGE) break;
  }

  // Members per group (with the details buildStandings needs).
  const membersByGroup = new Map<string, StandingMember[]>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("memberships")
      .select("user_id, group_id, display_name, joined_at")
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const m of data) {
      const gid = m.group_id as string;
      const member: StandingMember = {
        userId: m.user_id as string,
        displayName: m.display_name as string,
        joinedAt: m.joined_at as string,
      };
      const arr = membersByGroup.get(gid);
      if (arr) arr.push(member);
      else membersByGroup.set(gid, [member]);
    }
    if (data.length < PAGE) break;
  }

  // The scorable matches (confirmed, or in-play/just-finished with a score so
  // live results count provisionally) — mirrors getGroupStandings.
  const { data: matchData } = await db
    .from("matches")
    .select(SCORABLE_MATCH_COLUMNS)
    .or("result_confirmed.eq.true,status.eq.live,status.eq.finished");
  const matchRows = (matchData ?? []) as ScorableMatchRow[];
  const isProvisional = (m: ScorableMatchRow): boolean =>
    !m.result_confirmed &&
    (m.status === "live" || m.status === "finished") &&
    m.home_goals != null &&
    m.away_goals != null;
  const matches: StandingMatch[] = matchRows.map((m) => ({
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
  }));

  // Predictions for those matches, grouped by user. Paged past the row cap.
  const predsByUser = new Map<string, StandingPrediction[]>();
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length > 0) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("predictions")
        .select("user_id, match_id, pred_home, pred_away, advance_pick")
        .in("match_id", matchIds)
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      for (const p of data) {
        const uid = p.user_id as string;
        const pred: StandingPrediction = {
          userId: uid,
          matchId: p.match_id as string,
          predHome: p.pred_home as number,
          predAway: p.pred_away as number,
          advancePick: (p.advance_pick as string | null) ?? null,
        };
        const arr = predsByUser.get(uid);
        if (arr) arr.push(pred);
        else predsByUser.set(uid, [pred]);
      }
      if (data.length < PAGE) break;
    }
  }

  const countTrialMatches = isTrialActive();
  const byGroup = new Map<string, Map<string, number>>();
  // A member's scoring streak is per-group (a start_even group ignores pre-join
  // matches), so the digest headline takes their best across groups — the streak
  // their main board would show.
  const streakByUser = new Map<string, number>();
  for (const [gid, members] of membersByGroup) {
    const meta = groupsMeta.get(gid);
    if (!meta) continue;
    const predictions: StandingPrediction[] = [];
    for (const member of members) {
      const up = predsByUser.get(member.userId);
      if (up) predictions.push(...up);
    }
    const standings = buildStandings({
      members,
      matches,
      predictions,
      lateJoinPolicy: meta.lateJoinPolicy,
      groupCreatedAt: meta.createdAt,
      includeBaseline: true,
      countTrialMatches,
    });
    const ranks = competitionRanks(standings.overall);
    const userRank = new Map<string, number>();
    standings.overall.forEach((row, i) => {
      if (row.userId === BORINGBOT_ID) return;
      userRank.set(row.userId, ranks[i]);
      const streak = row.streak ?? 0;
      if (streak > (streakByUser.get(row.userId) ?? 0)) {
        streakByUser.set(row.userId, streak);
      }
    });
    byGroup.set(gid, userRank);
  }
  return { ranks: byGroup, streakByUser };
}

/** The previously-stored ranks, as group id -> (user id -> rank). Paged. */
async function loadRankSnapshots(
  db: SupabaseClient,
): Promise<Map<string, Map<string, number>>> {
  const byGroup = new Map<string, Map<string, number>>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("group_rank_snapshots")
      .select("group_id, user_id, rank")
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    for (const row of data) {
      const gid = row.group_id as string;
      let map = byGroup.get(gid);
      if (!map) byGroup.set(gid, (map = new Map()));
      map.set(row.user_id as string, row.rank as number);
    }
    if (data.length < PAGE) break;
  }
  return byGroup;
}

/** Overwrite the stored ranks with the current ones, so the next digest measures
 *  movement from here. Upserted in chunks on the (group_id, user_id) key. */
async function saveRankSnapshots(
  db: SupabaseClient,
  ranks: Map<string, Map<string, number>>,
  matchDay: string,
): Promise<void> {
  const now = new Date().toISOString();
  const rows: {
    group_id: string;
    user_id: string;
    rank: number;
    match_day: string;
    updated_at: string;
  }[] = [];
  for (const [gid, userRank] of ranks) {
    for (const [uid, rank] of userRank) {
      rows.push({ group_id: gid, user_id: uid, rank, match_day: matchDay, updated_at: now });
    }
  }
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .from("group_rank_snapshots")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "group_id,user_id" });
  }
}

/**
 * When the previous digest ran (the most recent snapshot's updated_at, epoch
 * ms), or null if none has — the boundary for "new since the last digest". Read
 * BEFORE saveRankSnapshots overwrites the snapshots, so the upsets it bounds are
 * exactly the matches settled between this digest and the previous one.
 */
async function loadLastDigestAt(db: SupabaseClient): Promise<number | null> {
  const { data } = await db
    .from("group_rank_snapshots")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  const ms = Date.parse(row.updated_at as string);
  return Number.isNaN(ms) ? null : ms;
}

const UPSET_MATCH_COLUMNS =
  "id, kickoff_at, stage, home_code, away_code, home_team, away_team, home_goals, away_goals, advanced_code";

interface UpsetMatchRow {
  id: string;
  kickoff_at: string;
  stage: Stage;
  home_code: string | null;
  away_code: string | null;
  home_team: string | null;
  away_team: string | null;
  home_goals: number | null;
  away_goals: number | null;
  advanced_code: string | null;
}

/**
 * Each member's fresh "against the crowd" calls: the confirmed matches that
 * kicked off since the last digest (`sinceMs`), scored against every group's
 * consensus with the same rule the per-match board uses (computeNewUpsets).
 * Only the recently-settled slate is loaded, so this is cheap — not the whole
 * tournament. Picks for a kicked-off match are already public, so revealing the
 * callers here leaks nothing.
 */
async function loadNewUpsets(
  db: SupabaseClient,
  groups: GroupStructure,
  sinceMs: number,
): Promise<Map<string, UpsetCall[]>> {
  const sinceIso = new Date(sinceMs).toISOString();
  const { data: matchData, error } = await db
    .from("matches")
    .select(UPSET_MATCH_COLUMNS)
    .eq("result_confirmed", true)
    .eq("is_trial", false)
    .gt("kickoff_at", sinceIso);
  if (error || !matchData) return new Map();

  const matches: UpsetMatch[] = [];
  for (const m of matchData as UpsetMatchRow[]) {
    if (m.home_goals == null || m.away_goals == null) continue;
    matches.push({
      id: m.id,
      kickoffMs: Date.parse(m.kickoff_at),
      label: `${teamLabel(m.home_code, m.home_team)} vs ${teamLabel(m.away_code, m.away_team)}`,
      stage: m.stage,
      homeCode: m.home_code,
      awayCode: m.away_code,
      result: { home: m.home_goals, away: m.away_goals, advancedCode: m.advanced_code },
    });
  }
  if (matches.length === 0) return new Map();

  // Picks for those (now public) matches, by match then user. Paged past the row
  // cap so a busy slate can't be silently truncated.
  const matchIds = matches.map((m) => m.id);
  const picksByMatch = new Map<string, Map<string, UpsetPick>>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error: predErr } = await db
      .from("predictions")
      .select("user_id, match_id, pred_home, pred_away, advance_pick")
      .in("match_id", matchIds)
      .range(from, from + PAGE - 1);
    if (predErr || !data) break;
    for (const p of data) {
      const mid = p.match_id as string;
      let byUser = picksByMatch.get(mid);
      if (!byUser) picksByMatch.set(mid, (byUser = new Map()));
      byUser.set(p.user_id as string, {
        home: p.pred_home as number,
        away: p.pred_away as number,
        advancePick: (p.advance_pick as string | null) ?? null,
      });
    }
    if (data.length < PAGE) break;
  }

  return computeNewUpsets(matches, picksByMatch, groups.membersByGroup, groups.groupName);
}

/** Escape user-supplied text (e.g. group names) for safe inlining into email HTML. */
function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * The day's matches as table rows, each tagged with the recipient's status:
 * a green ✓ for games they've already predicted, an amber "needs a pick" for the
 * rest. `done` is the set of match ids this recipient has predicted.
 */
function renderDigestRows(matches: MatchRow[], done: Set<string>): string {
  return matches
    .map((m) => {
      const home = teamLabel(m.home_code, m.home_team);
      const away = teamLabel(m.away_code, m.away_team);
      const stage = formatStageLabel(m.group_label, m.stage);
      const picked = done.has(m.id);
      const tag = picked
        ? `<span style="color:#0b8a3e;font-weight:600;">✓ predicted</span>`
        : `<span style="color:#b45309;font-weight:600;">needs a pick</span>`;
      return `<tr>
        <td style="padding:8px 0;font-weight:600;color:#1c1917;">${home} <span style="color:#a8a29e;font-weight:400;">vs</span> ${away}</td>
        <td style="padding:8px 0;text-align:right;color:#78716c;font-size:13px;">${stage}<br /><span style="font-size:12px;">${tag}</span></td>
      </tr>`;
    })
    .join("");
}

/**
 * One line of social proof per group: "Everyone else in Family is already in"
 * when all the recipient's group-mates have predicted, else "9 of 9 in Family
 * are already in". Group names are user-supplied, so they're HTML-escaped.
 */
function renderGroupFomo(stats: GroupStat[]): string {
  if (stats.length === 0) return "";
  const items = stats
    .map((s) => {
      const name = `<strong>${escapeHtml(s.name)}</strong>`;
      const verb = s.others === 1 ? "is" : "are";
      const mates = s.others === 1 ? "group-mate" : "group-mates";
      const line =
        s.predicted === s.others
          ? `Everyone else in ${name} is already in ✅`
          : `<strong>${s.predicted} of ${s.others}</strong> ${mates} in ${name} ${verb} already in`;
      return `<tr><td style="padding:6px 0;color:#57534e;font-size:14px;">${line}</td></tr>`;
    })
    .join("");
  return `<div style="margin:16px 0 0;background:#fffbeb;border:1px solid #fde68a;border-radius:16px;padding:14px 20px;">
        <p style="margin:0 0 6px;font-weight:700;font-size:14px;color:#92400e;">🔥 Your groups are already playing</p>
        <table style="width:100%;border-collapse:collapse;">${items}</table>
      </div>`;
}

/**
 * The recipient's climbs as a celebratory block: "↑ 3 spots in Family". Group
 * names are user-supplied, so they're HTML-escaped. Nothing renders when the
 * recipient hasn't climbed anywhere (or there's no prior snapshot yet).
 */
function renderClimb(climbs: Climb[]): string {
  if (climbs.length === 0) return "";
  const items = climbs
    .map((c) => {
      const spots = c.spots === 1 ? "1 spot" : `${c.spots} spots`;
      return `<tr><td style="padding:6px 0;color:#14532d;font-size:14px;">↑ <strong>${spots}</strong> in <strong>${escapeHtml(c.name)}</strong></td></tr>`;
    })
    .join("");
  return `<div style="margin:0 0 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:16px;padding:14px 20px;">
        <p style="margin:0 0 6px;font-weight:700;font-size:14px;color:#047857;">📈 You're climbing the leaderboard</p>
        <table style="width:100%;border-collapse:collapse;">${items}</table>
      </div>`;
}

/**
 * The recipient's celebratory achievements: their current scoring streak (the
 * same 🔥 the leaderboard and scorecard show, surfaced at the same ≥2 threshold)
 * and any fresh "against the crowd" 🔮 calls since the last digest, newest first
 * and capped. Group names are user-supplied, so they're HTML-escaped; team
 * labels come from the curated fixtures and are inlined as-is, like the match
 * rows. Nothing renders when there's neither a streak nor a new upset.
 */
function renderAchievements(streak: number, upsets: UpsetCall[]): string {
  const lines: string[] = [];
  if (streak >= 2) {
    lines.push(`🔥 <strong>${streak} in a row</strong> — your current run of correct calls`);
  }
  for (const u of upsets.slice(0, MAX_DIGEST_UPSETS)) {
    lines.push(
      `🔮 Called <strong>${u.match}</strong> against the crowd in <strong>${escapeHtml(u.group)}</strong>`,
    );
  }
  if (lines.length === 0) return "";
  const items = lines
    .map(
      (line) =>
        `<tr><td style="padding:6px 0;color:#5b21b6;font-size:14px;">${line}</td></tr>`,
    )
    .join("");
  return `<div style="margin:0 0 16px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:16px;padding:14px 20px;">
        <p style="margin:0 0 6px;font-weight:700;font-size:14px;color:#6d28d9;">🏅 Your achievements</p>
        <table style="width:100%;border-collapse:collapse;">${items}</table>
      </div>`;
}

/**
 * The consolidated match-day digest: how far the recipient has climbed, their
 * achievements (streak + fresh upset calls), the day's slate with their picks
 * marked, a one-line summary of what's still missing, and per-group FOMO.
 */
function renderDigestEmail(
  matches: MatchRow[],
  done: Set<string>,
  climbs: Climb[],
  streak: number,
  upsets: UpsetCall[],
  stats: GroupStat[],
  base: string,
  token: string,
): string {
  const rows = renderDigestRows(matches, done);
  const total = matches.length;
  const missing = matches.filter((m) => !done.has(m.id)).length;
  const summary =
    missing === 0
      ? `The day's first match kicks off in about an hour and every pick is in. You're all set — good luck! ✅`
      : missing === total
        ? `The day's first match kicks off in about an hour and you've got <strong>${total} match${total === 1 ? "" : "es"}</strong> to predict. Lock in your scorelines before kickoff — each match closes when it starts.`
        : `The day's first match kicks off in about an hour and you've still got <strong>${missing} of ${total}</strong> without a prediction. Lock them in before kickoff — each match closes when it starts.`;

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
    <div style="max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:22px;">⚽ Your match-day predictions</h1>
      <p style="margin:0 0 20px;color:#57534e;font-size:15px;">
        ${summary}
      </p>
      ${renderClimb(climbs)}
      ${renderAchievements(streak, upsets)}
      <div style="background:#ffffff;border-radius:16px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <table style="width:100%;border-collapse:collapse;font-size:15px;">${rows}</table>
      </div>
      ${renderGroupFomo(stats)}
      <div style="text-align:center;margin:24px 0;">
        <a href="${base}/predict" style="display:inline-block;background:#0b8a3e;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:9999px;font-size:16px;">
          ${missing === 0 ? "Review your predictions →" : "Make your predictions →"}
        </a>
      </div>
      <p style="margin:24px 0 0;color:#a8a29e;font-size:12px;text-align:center;">
        You're getting this because you're in a World Cup 2026 prediction group.<br />
        <a href="${base}/unsubscribe?token=${token}" style="color:#a8a29e;">Unsubscribe from these emails</a>
      </p>
    </div>
  </body>
</html>`;
}
