/**
 * The prediction reminder emails.
 *
 * Two self-throttling, cron-driven sends, both meant to be hit every few minutes:
 *   - notifyOpenWindows: the broadcast "predictions are open" announcement, ONE
 *     per match-day at its window-open instant. It only acts on a match-day whose
 *     window is open but whose first kickoff is still ahead, and claims the day in
 *     notified_match_days before sending, so overlapping ticks email each day once.
 *   - nudgeMissingPredictions: the per-user "you still have predictions missing"
 *     nudge, fired ONCE per match-day ~1h before that day's FIRST kickoff, to the
 *     members who haven't predicted every one of the day's games. Each email also
 *     carries per-group social proof — "9 of 9 of your group-mates are already in"
 *     — to nudge the laggards with a bit of FOMO. It claims the match-day in
 *     nudged_match_days before sending, so overlapping ticks nudge each day once.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { openMatchDays, dueMatchDaysForNudge } from "./notify-windows";
import { teamLabel } from "./fifa";
import { formatStageLabel } from "./format";
import { isEmailConfigured, sendEmailBatch, type EmailMessage } from "./email";
import { appBaseUrl } from "./app-url";
import type { Stage } from "./types";

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
  sent: number;
  skipped?: string;
}

/** How long before a match's kickoff the "you're missing this pick" nudge fires. */
const NUDGE_LEAD_MS = 1 * 60 * 60 * 1000;

const MATCH_COLUMNS =
  "id, kickoff_at, stage, group_label, home_code, away_code, home_team, away_team";

export async function notifyOpenWindows(
  now: Date = new Date(),
): Promise<NotifyResult> {
  if (!isEmailConfigured()) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "email not configured" };
  }

  const db = createAdminClient();

  const { data: matchData } = await db
    .from("matches")
    .select(MATCH_COLUMNS)
    .eq("is_trial", false);
  const matches = (matchData ?? []) as MatchRow[];

  // Every match-day whose window is open and whose first kickoff is still ahead,
  // earliest-opening first. There can be more than one at once — e.g. today's
  // games (opened yesterday, not yet kicked off) AND tomorrow's (opened today).
  const open = openMatchDays(matches, now);
  if (open.length === 0) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "no open match-day" };
  }

  // Announce the earliest open day we haven't already sent. Claiming each day in
  // turn — rather than bailing on the earliest — is the fix for the bug where a
  // newly-opened day was suppressed while an earlier day sat in its (already
  // announced) pre-kickoff window. The PK insert makes the claim exactly-once.
  let matchDay: string | null = null;
  let dueMatches: MatchRow[] = [];
  for (const day of open) {
    const { error: claimErr } = await db
      .from("notified_match_days")
      .insert({ match_day: day.matchDay });
    if (claimErr) continue; // already announced — try the next open day
    matchDay = day.matchDay;
    dueMatches = day.matches;
    break;
  }
  if (matchDay == null) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "all open match-days already notified" };
  }

  const subject = `⚽ Predictions are open — ${dueMatches.length} match${
    dueMatches.length === 1 ? "" : "es"
  }`;
  const base = appBaseUrl();
  const ordered = [...dueMatches].sort(
    (a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at),
  );

  // We've claimed the day; if the send setup throws before any mail goes out,
  // release the claim so a later tick retries rather than leaving the
  // announcement permanently unsent. (sendEmailBatch itself never throws.)
  let recipientCount = 0;
  let sent = 0;
  try {
    const recipients = await loadRecipients(db);
    recipientCount = recipients.length;
    const messages: EmailMessage[] = recipients.map((r) => ({
      to: r.email,
      subject,
      html: renderEmail(ordered, base, r.token),
      headers: { "List-Unsubscribe": `<${base}/unsubscribe?token=${r.token}>` },
    }));
    sent = await sendEmailBatch(messages);
  } catch (e) {
    await db.from("notified_match_days").delete().eq("match_day", matchDay);
    throw e;
  }

  await db.from("notified_match_days").update({ recipients: sent }).eq("match_day", matchDay);

  return { ok: true, matchDay, recipients: recipientCount, sent };
}

/**
 * The once-per-match-day "you still have predictions missing" nudge.
 *
 * Fires ~NUDGE_LEAD_MS before a match-day's FIRST kickoff, in ONE email per
 * member who hasn't predicted every one of that day's games. The match-day is
 * claimed in nudged_match_days (PK insert) before sending, so overlapping ticks
 * (and repeat runs) nudge each day exactly once. Each email also carries
 * per-group social proof — how many of the recipient's group-mates have already
 * made a pick for the day — to give the laggards a nudge of FOMO.
 */
export async function nudgeMissingPredictions(
  now: Date = new Date(),
): Promise<NotifyResult> {
  if (!isEmailConfigured()) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "email not configured" };
  }

  const db = createAdminClient();

  const { data: matchData } = await db
    .from("matches")
    .select(MATCH_COLUMNS)
    .eq("is_trial", false);
  const matches = (matchData ?? []) as MatchRow[];

  // Match-days whose first kickoff is within the lead window (about to begin).
  const dueDays = dueMatchDaysForNudge(matches, now, NUDGE_LEAD_MS);
  if (dueDays.length === 0) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "no match-day kicking off soon" };
  }

  // Claim the earliest unclaimed due day (PK insert = exactly-once). One per
  // tick is plenty: the 1h lead window spans several 15-min ticks, so a second
  // due day (rare) is picked up on a later tick, still before its kickoff.
  let matchDay: string | null = null;
  let dueMatches: MatchRow[] = [];
  for (const day of dueDays) {
    const { error: claimErr } = await db
      .from("nudged_match_days")
      .insert({ match_day: day.matchDay });
    if (claimErr) continue; // already nudged — try the next due day
    matchDay = day.matchDay;
    dueMatches = day.matches;
    break;
  }
  if (matchDay == null) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "all due match-days already nudged" };
  }

  try {
    const dayMatchIds = dueMatches.map((m) => m.id);
    // Who has predicted which of the day's games. A failed read must NOT look
    // like "nobody predicted" — that would nudge members who're already done
    // and understate the FOMO counts — so release the claim and bail to retry.
    const predicted = await loadPredictedByUser(db, dayMatchIds);
    if (!predicted) {
      await db.from("nudged_match_days").delete().eq("match_day", matchDay);
      return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "prediction read failed" };
    }
    // Anyone with ≥1 pick among the day's games counts as "in" for the stats.
    const participants = new Set(predicted.keys());

    const groups = await loadGroupStructure(db);
    const recipients = await loadRecipients(db);
    const base = appBaseUrl();
    const ordered = [...dueMatches].sort(
      (a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at),
    );

    // One email per member who hasn't finished the day, listing what they're
    // still missing plus how many of their group-mates are already in.
    const messages: EmailMessage[] = [];
    for (const r of recipients) {
      const done = predicted.get(r.userId) ?? new Set<string>();
      const missing = ordered.filter((m) => !done.has(m.id));
      if (missing.length === 0) continue; // already predicted the whole day

      const stats = groupStatsFor(r.userId, groups, participants);
      messages.push({
        to: r.email,
        subject: `⏳ ${missing.length} prediction${
          missing.length === 1 ? "" : "s"
        } left before kickoff`,
        html: renderNudgeEmail(missing, stats, base, r.token),
        headers: { "List-Unsubscribe": `<${base}/unsubscribe?token=${r.token}>` },
      });
    }

    const sent = await sendEmailBatch(messages);
    await db.from("nudged_match_days").update({ recipients: sent }).eq("match_day", matchDay);

    return { ok: true, matchDay, recipients: messages.length, sent };
  } catch (e) {
    // Couldn't finish after claiming: release so a later tick retries cleanly.
    await db.from("nudged_match_days").delete().eq("match_day", matchDay);
    throw e;
  }
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

/** Escape user-supplied text (e.g. group names) for safe inlining into email HTML. */
function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** The match list as table rows, shared by both reminder emails. */
function renderMatchRows(matches: MatchRow[]): string {
  return matches
    .map((m) => {
      const home = teamLabel(m.home_code, m.home_team);
      const away = teamLabel(m.away_code, m.away_team);
      const stage = formatStageLabel(m.group_label, m.stage);
      return `<tr>
        <td style="padding:8px 0;font-weight:600;color:#1c1917;">${home} <span style="color:#a8a29e;font-weight:400;">vs</span> ${away}</td>
        <td style="padding:8px 0;text-align:right;color:#78716c;font-size:13px;">${stage}</td>
      </tr>`;
    })
    .join("");
}

function renderEmail(matches: MatchRow[], base: string, token: string): string {
  const rows = renderMatchRows(matches);

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
    <div style="max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:22px;">⚽ Predictions are open</h1>
      <p style="margin:0 0 20px;color:#57534e;font-size:15px;">
        A new match-day is open. Lock in your scorelines before kickoff — each match closes when it starts.
      </p>
      <div style="background:#ffffff;border-radius:16px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <table style="width:100%;border-collapse:collapse;font-size:15px;">${rows}</table>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="${base}/predict" style="display:inline-block;background:#0b8a3e;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:9999px;font-size:16px;">
          Make your predictions →
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

/** The "you've still got gaps before kickoff" nudge, with per-group FOMO. */
function renderNudgeEmail(
  missing: MatchRow[],
  stats: GroupStat[],
  base: string,
  token: string,
): string {
  const rows = renderMatchRows(missing);
  const n = missing.length;
  const count = n === 1 ? "1 match" : `${n} matches`;
  const fomo = renderGroupFomo(stats);

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
    <div style="max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:22px;">⏳ Kickoff's coming up</h1>
      <p style="margin:0 0 20px;color:#57534e;font-size:15px;">
        The day's first match kicks off in about an hour and you've still got <strong>${count}</strong> without a prediction. Lock them in before kickoff — each match closes when it starts.
      </p>
      <div style="background:#ffffff;border-radius:16px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <table style="width:100%;border-collapse:collapse;font-size:15px;">${rows}</table>
      </div>
      ${fomo}
      <div style="text-align:center;margin:24px 0;">
        <a href="${base}/predict" style="display:inline-block;background:#0b8a3e;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:9999px;font-size:16px;">
          Finish your predictions →
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
