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
import { windowOpensAt } from "./prediction-rules";
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

export async function notifyOpenWindows(
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

  // Group matches by the instant their match-day opened for prediction.
  const byOpen = new Map<number, MatchRow[]>();
  for (const m of matches) {
    const opensAt = windowOpensAt(m.kickoff_at);
    const arr = byOpen.get(opensAt);
    if (arr) arr.push(m);
    else byOpen.set(opensAt, [m]);
  }

  // The match-day to announce: window already open, first kickoff still ahead.
  // Picking the earliest such day (and only one per call) keeps it to one email
  // a day and avoids back-blasting days that already kicked off.
  let dueOpen: number | null = null;
  let dueMatches: MatchRow[] = [];
  for (const [opensAt, group] of [...byOpen.entries()].sort((a, b) => a[0] - b[0])) {
    const earliestKickoff = Math.min(...group.map((m) => Date.parse(m.kickoff_at)));
    if (opensAt <= nowMs && nowMs < earliestKickoff) {
      dueOpen = opensAt;
      dueMatches = group;
      break;
    }
  }
  if (dueOpen == null) {
    return { ok: true, matchDay: null, recipients: 0, sent: 0, skipped: "no open match-day" };
  }

  const matchDay = new Date(dueOpen).toISOString();

  // Claim the day first: the primary-key insert fails if another tick already
  // sent it, making the whole thing exactly-once.
  const { error: claimErr } = await db
    .from("notified_match_days")
    .insert({ match_day: matchDay });
  if (claimErr) {
    return { ok: true, matchDay, recipients: 0, sent: 0, skipped: "already notified" };
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
    out.push({ email, token: pref.unsubscribe_token as string });
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
