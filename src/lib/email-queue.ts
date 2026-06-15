/**
 * One queue for ALL outbound email, drained by ONE single-flight, rate-limited
 * drainer.
 *
 * The cap is on individual emails DELIVERED: at most EMAIL_RATE_PER_MIN (default
 * 2) per rolling minute, across both paths combined. The two email paths used to
 * throttle themselves independently against different ideas of the limit, with
 * nothing coordinating them — so a sign-in rush overlapping a match-day broadcast
 * could collectively overshoot. Now both ride this queue:
 *   - 'login'  rows: the one-time sign-in code is minted at SEND time (codes
 *     expire fast, and this way no live credential is ever stored — the row only
 *     holds the address + post-auth destination). One email per row.
 *   - 'digest' rows: the per-user match-day email, pre-rendered. One email per
 *     row; rows are grouped into a single Resend batch request (up to BATCH_MAX,
 *     and never more than the minute's remaining budget) to save round-trips.
 *
 * Rate gate: each drain counts the emails already sent in the trailing 60s and
 * sends only up to the remaining budget — no in-process sleeping to pace a slow
 * cadence, so even a 2/min cap never blocks a serverless invocation. The
 * single-flight lock (email_drain_lock) means at most one drainer runs at a time
 * anywhere, so the rolling count is authoritative. A drain is kicked inline after
 * enqueue (so a lone user gets their code immediately) and every minute by the
 * /api/poll cron (so backlogs keep draining, one minute's budget at a time).
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendEmailBatch, isEmailConfigured, type EmailMessage } from "@/lib/email";
import { appBaseUrl } from "@/lib/app-url";

/** Emails allowed per rolling minute — your Resend cap. Override per environment
 *  via EMAIL_RATE_PER_MIN (raise it once Resend lifts your limit). */
export function ratePerMin(): number {
  const n = Number(process.env.EMAIL_RATE_PER_MIN);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

/** Messages per Resend batch request — Resend's per-request cap. A single digest
 *  batch never exceeds this (nor the minute's remaining email budget). */
const BATCH_MAX = 100;
/** Cron drains send at most this many emails per run, on top of the per-minute
 *  budget — a ceiling on one serverless invocation's work; the next tick
 *  continues any remaining backlog. */
const MAX_EMAILS_PER_DRAIN = 100;
/** Inline kicks (on a sign-in request) send at most this many emails so the HTTP
 *  response stays snappy — the cron handles the bulk. */
export const INLINE_MAX_EMAILS = 2;
/** A short gap between two Resend requests in one drain, so back-to-back sends
 *  stay under Resend's per-second sub-limit (the per-minute budget is the main
 *  gate; this only matters when several go out in one drain). */
const REQUEST_SPACING_MS = 600;
/** Give up on a row after this many failed send attempts. */
const MAX_ATTEMPTS = 5;
/** Reclaim a row stuck in 'sending' (drainer crashed mid-send) after this long. */
const CLAIM_TTL_MS = 2 * 60 * 1000;
/** Reclaim the drain lock if a drainer crashed while holding it. */
const LOCK_TTL_MS = 60 * 1000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface QueueRow {
  id: number;
  kind: string;
  recipient: string;
  subject: string | null;
  html: string | null;
  headers: Record<string, string> | null;
  next: string | null;
  attempts: number;
}

const ROW_COLUMNS = "id,kind,recipient,subject,html,headers,next,attempts";

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

/**
 * Add a sign-in request to the queue. The code itself is minted later, at send
 * time. Returns the new row id so the caller can kick a drain and then check
 * whether this particular code went out immediately.
 */
export async function enqueueLoginEmail(
  email: string,
  next: string,
): Promise<{ id: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_queue")
    .insert({ kind: "login", recipient: email, next })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Could not queue sign-in email: ${error?.message ?? "no row"}`);
  }
  return { id: data.id as number };
}

/** Enqueue a batch of pre-rendered per-user digest emails. Returns the count queued. */
export async function enqueueDigestEmails(messages: EmailMessage[]): Promise<number> {
  if (messages.length === 0) return 0;
  const admin = createAdminClient();
  const rows = messages.map((m) => ({
    kind: "digest",
    recipient: m.to,
    subject: m.subject,
    html: m.html,
    headers: m.headers ?? null,
  }));

  let queued = 0;
  const CHUNK = 500; // keep each insert's payload bounded
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await admin.from("email_queue").insert(slice);
    if (!error) queued += slice.length;
  }
  return queued;
}

// ---------------------------------------------------------------------------
// Status / ETA (sign-in codes)
// ---------------------------------------------------------------------------

/** Status of a queued row, or null if it's gone. */
export async function loginEmailStatus(id: number): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("email_queue")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  return (data?.status as string | undefined) ?? null;
}

/**
 * Estimate, in seconds, when the sign-in code for row `id` will land. The drainer
 * clears ratePerMin() EMAILS per minute, oldest first, one email per row. So the
 * wait is the number of emails ahead of this row — every still-pending sign-in at
 * or before it, plus every pending digest ahead — over the per-minute rate. Drain
 * cycles are driven by the every-minute cron, so each counts as ~a minute (which
 * also folds in the wait for the next tick). Deliberately a touch conservative:
 * under-promising and landing early is better.
 */
export async function estimateEtaSeconds(id: number): Promise<number> {
  const admin = createAdminClient();
  const { count: loginAhead } = await admin
    .from("email_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("kind", "login")
    .lte("id", id);
  const { count: digestAhead } = await admin
    .from("email_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("kind", "digest")
    .lt("id", id);

  const emailsAhead = Math.max(1, loginAhead ?? 1) + (digestAhead ?? 0);
  return Math.ceil(emailsAhead / ratePerMin()) * 60;
}

// ---------------------------------------------------------------------------
// Drain
// ---------------------------------------------------------------------------

/** The sign-in email body: the 6-digit code front and centre (works in any
 *  browser via the code box), with a one-tap server-side link fallback. */
function codeEmailHtml(code: string, link: string): string {
  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto">
  <h2 style="margin:0 0 8px">Your World Cup 2026 sign-in code</h2>
  <p style="font-size:15px;color:#444;margin:0 0 16px">
    Enter this code in the tab where you started signing in:
  </p>
  <p style="font-family:ui-monospace,Menlo,monospace;font-size:34px;font-weight:800;
            letter-spacing:10px;background:#f3f0fa;color:#1c1917;
            padding:16px 20px;border-radius:14px;text-align:center;
            margin:0 0 8px;user-select:all">${code}</p>
  <p style="font-size:13px;color:#777;margin:0 0 28px">
    Typing the code keeps you signed in <strong>in the browser you want to play in</strong>.
    The code expires shortly &mdash; request a new one if it does.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:0 0 20px">
  <p style="font-size:13px;color:#777;margin:0 0 12px">
    Prefer to just tap? This link signs you in:
  </p>
  <p style="margin:0">
    <a href="${link}" style="display:inline-block;background:#0b8a3e;color:#fff;
              font-weight:700;font-size:15px;text-decoration:none;
              padding:12px 22px;border-radius:999px">Sign in &rarr;</a>
  </p>
</div>`.trim();
}

/** Mint a fresh one-time code for this sign-in row and email it. Existing user →
 *  a "magiclink" code; brand-new one → a "signup" code. Throws if the code can't
 *  be minted or the send fails, so the caller can leave the row pending to retry. */
async function sendLoginRow(admin: SupabaseClient, row: QueueRow): Promise<void> {
  let res = await admin.auth.admin.generateLink({ type: "magiclink", email: row.recipient });
  if (res.error || !res.data?.properties?.email_otp) {
    res = await admin.auth.admin.generateLink({
      type: "signup",
      email: row.recipient,
      password: randomUUID(),
    });
  }
  const props = res.data?.properties;
  if (res.error || !props?.email_otp) {
    throw new Error("Could not mint a sign-in code.");
  }

  const link =
    `${appBaseUrl()}/auth/confirm?token_hash=${props.hashed_token}` +
    `&type=${props.verification_type}&next=${encodeURIComponent(row.next ?? "/")}`;
  await sendEmail({
    to: row.recipient,
    subject: `Your World Cup 2026 sign-in code: ${props.email_otp}`,
    html: codeEmailHtml(props.email_otp, link),
  });
}

/** Claim a stale-free single-flight lock. Returns true if THIS caller now holds
 *  it (so it should drain), false if another drainer holds a fresh lock. */
async function acquireDrainLock(admin: SupabaseClient): Promise<boolean> {
  const staleBefore = new Date(Date.now() - LOCK_TTL_MS).toISOString();
  const { data } = await admin
    .from("email_drain_lock")
    .update({ locked_at: new Date().toISOString() })
    .eq("id", 1)
    .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
    .select("id");
  return Boolean(data && data.length > 0);
}

async function releaseDrainLock(admin: SupabaseClient): Promise<void> {
  await admin.from("email_drain_lock").update({ locked_at: null }).eq("id", 1);
}

/** Mark rows sent. */
async function markSent(admin: SupabaseClient, ids: number[]): Promise<void> {
  await admin
    .from("email_queue")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .in("id", ids);
}

/** Bump attempts and return a row to 'pending' (or 'failed' past the cap). */
async function markFailed(admin: SupabaseClient, rows: QueueRow[]): Promise<void> {
  for (const row of rows) {
    const attempts = (row.attempts ?? 0) + 1;
    await admin
      .from("email_queue")
      .update({ status: attempts >= MAX_ATTEMPTS ? "failed" : "pending", attempts })
      .eq("id", row.id);
  }
}

/**
 * Send queued mail up to the rolling-minute budget (and `maxEmails`), oldest
 * first — one email per login row, or a batch of digests grouped into one Resend
 * request. Caller must already hold the drain lock. The budget counts emails
 * actually sent in the last 60s, so the inline kick and the cron can't
 * collectively overshoot. No long sleeps, so even a slow (per-minute) cadence
 * returns promptly; a short spacing between requests avoids tripping a per-second
 * sub-limit. Never throws — a failed send leaves its row pending (or marks it
 * failed past MAX_ATTEMPTS) for the next drain.
 */
async function drainWhileLocked(
  admin: SupabaseClient,
  maxEmails: number,
): Promise<number> {
  // Budget: the per-minute cap minus what's already gone out this rolling minute
  // (each sent row is one email), then bounded by this invocation's ceiling.
  const { count: recent } = await admin
    .from("email_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", new Date(Date.now() - 60_000).toISOString());
  let budget = Math.min(maxEmails, ratePerMin() - (recent ?? 0));
  if (budget <= 0) return 0;

  let sent = 0;
  let firstRequest = true;

  while (budget > 0) {
    const { data: page } = await admin
      .from("email_queue")
      .select(ROW_COLUMNS)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_MAX);
    const rows = (page ?? []) as QueueRow[];
    if (rows.length === 0) break;

    // The next request takes the oldest row's kind: one login code, or a batch of
    // digests — never more than the minute's remaining budget (nor Resend's
    // per-request cap).
    const target =
      rows[0].kind === "login"
        ? [rows[0]]
        : rows.filter((r) => r.kind === "digest").slice(0, Math.min(budget, BATCH_MAX));

    // Claim them so a crash can't double-send (and to skip rows another path
    // already took, though single-flight makes that rare).
    const { data: claimedData } = await admin
      .from("email_queue")
      .update({ status: "sending", claimed_at: new Date().toISOString() })
      .in("id", target.map((r) => r.id))
      .eq("status", "pending")
      .select(ROW_COLUMNS);
    const claimed = (claimedData ?? []) as QueueRow[];
    if (claimed.length === 0) continue;

    // Spend the budget on the emails we're attempting now, whether or not the
    // send succeeds (a failed request may still have reached Resend); failed rows
    // return to pending for the NEXT minute's budget to retry.
    budget -= claimed.length;

    // A short gap between requests keeps two sends in one drain under Resend's
    // per-second sub-limit — never before the first, so a lone code is instant.
    if (!firstRequest) await sleep(REQUEST_SPACING_MS);
    firstRequest = false;

    if (claimed[0].kind === "login") {
      const row = claimed[0];
      try {
        await sendLoginRow(admin, row);
        await markSent(admin, [row.id]);
        sent++;
      } catch {
        await markFailed(admin, [row]);
      }
    } else {
      const messages: EmailMessage[] = claimed.map((r) => ({
        to: r.recipient,
        subject: r.subject ?? "",
        html: r.html ?? "",
        headers: r.headers ?? undefined,
      }));
      // One sub-batch (≤100), so sendEmailBatch sends all or — on a failed
      // request — none; mark accordingly.
      const ok = await sendEmailBatch(messages);
      if (ok === claimed.length) {
        await markSent(admin, claimed.map((r) => r.id));
        sent += claimed.length;
      } else {
        await markFailed(admin, claimed);
      }
    }
  }
  return sent;
}

/**
 * Drain the queue under the single-flight lock. Safe to call from the inline
 * kick and the cron at once: only one caller holds the lock and actually drains;
 * the others return immediately. `maxEmails` bounds the work so an inline kick
 * stays snappy (pass INLINE_MAX_EMAILS) while the cron clears the backlog.
 */
export async function drainEmailQueue(
  maxEmails: number = MAX_EMAILS_PER_DRAIN,
): Promise<{ sent: number }> {
  if (!isEmailConfigured()) return { sent: 0 };
  const admin = createAdminClient();

  // Reclaim rows orphaned in 'sending' by a crashed drainer.
  await admin
    .from("email_queue")
    .update({ status: "pending" })
    .eq("status", "sending")
    .lt("claimed_at", new Date(Date.now() - CLAIM_TTL_MS).toISOString());

  if (!(await acquireDrainLock(admin))) return { sent: 0 };
  try {
    const sent = await drainWhileLocked(admin, maxEmails);
    return { sent };
  } finally {
    await releaseDrainLock(admin);
  }
}
