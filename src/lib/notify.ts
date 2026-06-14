/**
 * The prediction reminder emails.
 *
 * Two self-throttling, cron-driven sends, both meant to be hit every few minutes:
 *   - notifyOpenWindows: the broadcast "predictions are open" announcement, ONE
 *     per match-day at its window-open instant. It only acts on a match-day whose
 *     window is open but whose first kickoff is still ahead, and claims the day in
 *     notified_match_days before sending, so overlapping ticks email each day once.
 *   - nudgeMissingPredictions: the per-user "you still haven't predicted this
 *     game" nudge, fired ~1h before EACH match's kickoff to the members missing
 *     that specific match. It claims each match in nudged_matches before sending,
 *     so overlapping ticks nudge each match exactly once.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { openMatchDays, dueForNudge } from "./notify-windows";
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
 * The per-user "you still have a prediction missing" nudge.
 *
 * Fires ~NUDGE_LEAD_MS before EACH match's kickoff, to every member who hasn't
 * predicted that specific match. Each match is claimed in nudged_matches before
 * sending, so overlapping ticks (and repeat runs) nudge each match exactly once.
 * Matches that fall due in the same tick (e.g. simultaneous kickoffs) are batched
 * into one email per user; matches further apart come back on their own tick, so
 * a forgotten late game still gets its own hour-out reminder.
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

  // Every match about to kick off (kickoff − lead ≤ now < kickoff).
  const due = dueForNudge(matches, now, NUDGE_LEAD_MS);
  if (due.length === 0) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "no match kicking off soon" };
  }

  // Claim each due match (PK insert) so overlapping ticks nudge each exactly
  // once; keep only the ones we won this tick.
  const claimed: MatchRow[] = [];
  for (const match of due) {
    const { error: claimErr } = await db
      .from("nudged_matches")
      .insert({ match_id: match.id });
    if (!claimErr) claimed.push(match);
  }
  if (claimed.length === 0) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "all due matches already nudged" };
  }
  const claimedIds = claimed.map((m) => m.id);

  try {
    // Who has already predicted each claimed match. A failed read here must NOT
    // be treated as "nobody predicted" — that would nudge people who already
    // have picks in — so on error we release this tick's claims and bail to retry.
    const predicted = await loadPredictedByUser(db, claimedIds);
    if (!predicted) {
      await db.from("nudged_matches").delete().in("match_id", claimedIds);
      return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "prediction read failed" };
    }

    const recipients = await loadRecipients(db);
    const base = appBaseUrl();
    const ordered = [...claimed].sort(
      (a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at),
    );

    // One email per member listing the claimed matches they're still missing.
    const nudgedPerMatch = new Map<string, number>();
    const messages: EmailMessage[] = [];
    for (const r of recipients) {
      const done = predicted.get(r.userId) ?? new Set<string>();
      const missing = ordered.filter((m) => !done.has(m.id));
      if (missing.length === 0) continue;
      for (const m of missing) {
        nudgedPerMatch.set(m.id, (nudgedPerMatch.get(m.id) ?? 0) + 1);
      }
      messages.push({
        to: r.email,
        subject: `⏳ ${missing.length} prediction${
          missing.length === 1 ? "" : "s"
        } left before kickoff`,
        html: renderNudgeEmail(missing, base, r.token),
        headers: { "List-Unsubscribe": `<${base}/unsubscribe?token=${r.token}>` },
      });
    }

    const sent = await sendEmailBatch(messages);

    // Record, per claimed match, how many members we nudged about it.
    for (const m of claimed) {
      await db
        .from("nudged_matches")
        .update({ recipients: nudgedPerMatch.get(m.id) ?? 0 })
        .eq("match_id", m.id);
    }

    return { ok: true, matchDay: null, recipients: messages.length, sent };
  } catch (e) {
    // Couldn't finish after claiming: release so a later tick retries cleanly.
    await db.from("nudged_matches").delete().in("match_id", claimedIds);
    throw e;
  }
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

/** The gentle "you've still got gaps before kickoff" nudge for one recipient. */
function renderNudgeEmail(missing: MatchRow[], base: string, token: string): string {
  const rows = renderMatchRows(missing);
  const n = missing.length;
  const count = n === 1 ? "1 match" : `${n} matches`;

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
    <div style="max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:22px;">⏳ Kickoff's coming up</h1>
      <p style="margin:0 0 20px;color:#57534e;font-size:15px;">
        Kickoff is about an hour away and you've still got <strong>${count}</strong> without a prediction. Lock them in before kickoff — each match closes when it starts.
      </p>
      <div style="background:#ffffff;border-radius:16px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <table style="width:100%;border-collapse:collapse;font-size:15px;">${rows}</table>
      </div>
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
