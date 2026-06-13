/**
 * The daily "predictions are open" email.
 *
 * A whole match-day's games open for prediction at the same instant
 * (windowOpensAt), so each match-day gets ONE announcement email. notifyOpenWindows
 * is meant to be called by the cron every few minutes; it self-throttles:
 *   - it only acts on a match-day whose window is open but whose first kickoff is
 *     still ahead (so it never back-blasts days that already started), and
 *   - it claims the day in notified_match_days before sending, so overlapping
 *     cron ticks (and repeat runs) email each match-day exactly once.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { groupMatchDays, openMatchDays } from "./notify-windows";
import { teamLabel } from "./fifa";
import { formatStageLabel } from "./format";
import { isEmailConfigured, sendEmail } from "./email";
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

/** How long before a match-day's first kickoff the "you're missing picks" nudge fires. */
const NUDGE_LEAD_MS = 1 * 60 * 60 * 1000;

export async function notifyOpenWindows(
  now: Date = new Date(),
): Promise<NotifyResult> {
  if (!isEmailConfigured()) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "email not configured" };
  }

  const db = createAdminClient();

  const { data: matchData } = await db
    .from("matches")
    .select(
      "id, kickoff_at, stage, group_label, home_code, away_code, home_team, away_team",
    )
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

  const recipients = await loadRecipients(db);
  const subject = `⚽ Predictions are open — ${dueMatches.length} match${
    dueMatches.length === 1 ? "" : "es"
  }`;
  const base = appBaseUrl();
  const ordered = [...dueMatches].sort(
    (a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at),
  );

  let sent = 0;
  const CHUNK = 20; // gentle on the provider's rate limit
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const slice = recipients.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      slice.map((r) =>
        sendEmail({
          to: r.email,
          subject,
          html: renderEmail(ordered, base, r.token),
          headers: { "List-Unsubscribe": `<${base}/unsubscribe?token=${r.token}>` },
        }),
      ),
    );
    sent += results.filter((x) => x.status === "fulfilled").length;
  }

  await db.from("notified_match_days").update({ recipients: sent }).eq("match_day", matchDay);

  return { ok: true, matchDay, recipients: recipients.length, sent };
}

/**
 * The per-user "you still have predictions missing" nudge.
 *
 * Fires once per match-day, ~1h (NUDGE_LEAD_MS) before that day's FIRST kickoff, to
 * each member who hasn't predicted one or more of the day's matches — listing
 * only the ones they're missing. Like notifyOpenWindows it's meant to run on the
 * cron and self-throttles: it claims the day in nudged_match_days before sending,
 * so overlapping ticks (and repeat runs) nudge each match-day exactly once.
 */
export async function nudgeMissingPredictions(
  now: Date = new Date(),
): Promise<NotifyResult> {
  if (!isEmailConfigured()) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "email not configured" };
  }

  const db = createAdminClient();
  const nowMs = now.getTime();

  const { data: matchData } = await db
    .from("matches")
    .select(
      "id, kickoff_at, stage, group_label, home_code, away_code, home_team, away_team",
    )
    .eq("is_trial", false);
  const matches = (matchData ?? []) as MatchRow[];

  // The match-day to nudge: its first kickoff is within the lead window ahead
  // (kickoff − lead ≤ now < kickoff). Earliest such day, one per call. (Match-day
  // first-kickoffs are ~a day apart, so at most one is ever in the lead window.)
  const due = groupMatchDays(matches).find((d) => {
    const earliestKickoff = Math.min(
      ...d.matches.map((m) => Date.parse(m.kickoff_at)),
    );
    return earliestKickoff - NUDGE_LEAD_MS <= nowMs && nowMs < earliestKickoff;
  });
  if (!due) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "no match-day going live soon" };
  }

  const matchDay = due.matchDay;
  const dueMatches = due.matches;

  // Claim the day first (PK insert) so concurrent ticks nudge it exactly once.
  const { error: claimErr } = await db
    .from("nudged_match_days")
    .insert({ match_day: matchDay });
  if (claimErr) {
    return { ok: true, matchDay, recipients: 0, sent: 0, skipped: "already nudged" };
  }

  // Who has predicted which of this day's matches.
  const dayMatchIds = dueMatches.map((m) => m.id);
  const { data: predRows } = await db
    .from("predictions")
    .select("user_id, match_id")
    .in("match_id", dayMatchIds);
  const predictedByUser = new Map<string, Set<string>>();
  for (const p of predRows ?? []) {
    const set = predictedByUser.get(p.user_id as string) ?? new Set<string>();
    set.add(p.match_id as string);
    predictedByUser.set(p.user_id as string, set);
  }

  const recipients = await loadRecipients(db);
  const base = appBaseUrl();
  const ordered = [...dueMatches].sort(
    (a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at),
  );

  // For each recipient, the day's matches they haven't predicted. Only people
  // with at least one gap get the nudge.
  const targets: { recipient: Recipient; missing: MatchRow[] }[] = [];
  for (const r of recipients) {
    const done = predictedByUser.get(r.userId) ?? new Set<string>();
    const missing = ordered.filter((m) => !done.has(m.id));
    if (missing.length > 0) targets.push({ recipient: r, missing });
  }

  let sent = 0;
  const CHUNK = 20; // gentle on the provider's rate limit
  for (let i = 0; i < targets.length; i += CHUNK) {
    const slice = targets.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      slice.map(({ recipient, missing }) =>
        sendEmail({
          to: recipient.email,
          subject: `⏳ ${missing.length} prediction${
            missing.length === 1 ? "" : "s"
          } left before kickoff`,
          html: renderNudgeEmail(missing, base, recipient.token),
          headers: { "List-Unsubscribe": `<${base}/unsubscribe?token=${recipient.token}>` },
        }),
      ),
    );
    sent += results.filter((x) => x.status === "fulfilled").length;
  }

  await db.from("nudged_match_days").update({ recipients: sent }).eq("match_day", matchDay);

  return { ok: true, matchDay, recipients: targets.length, sent };
}

/** Everyone in at least one group, with an email, who hasn't opted out. */
async function loadRecipients(db: SupabaseClient): Promise<Recipient[]> {
  const { data: members } = await db.from("memberships").select("user_id");
  const memberIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  if (memberIds.length === 0) return [];

  const { data: prefs } = await db
    .from("users")
    .select("id, email_opt_out, unsubscribe_token")
    .in("id", memberIds);
  const prefById = new Map((prefs ?? []).map((p) => [p.id as string, p]));

  const emailById = await loadEmails(db);

  const out: Recipient[] = [];
  for (const id of memberIds) {
    const pref = prefById.get(id);
    const email = emailById.get(id);
    if (!pref || pref.email_opt_out || !email) continue;
    out.push({ userId: id, email, token: pref.unsubscribe_token as string });
  }
  return out;
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

function renderEmail(matches: MatchRow[], base: string, token: string): string {
  const rows = matches
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
  const rows = missing
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
  const n = missing.length;
  const count = n === 1 ? "1 match" : `${n} matches`;

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
    <div style="max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:22px;">⏳ Kickoff's coming up</h1>
      <p style="margin:0 0 20px;color:#57534e;font-size:15px;">
        Today's match-day goes live soon and you've still got <strong>${count}</strong> without a prediction. Lock them in before kickoff — each match closes when it starts.
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
