/**
 * One queue for ALL outbound email, drained by ONE single-flight, rate-limited
 * drainer.
 *
 * Resend's real cap is 2 requests/second. A batch request (up to 100 messages)
 * counts as ONE request. The two email paths used to throttle themselves
 * independently against different ideas of the limit, with nothing coordinating
 * them — so a sign-in rush overlapping a match-day broadcast could collectively
 * overshoot. Now both ride this queue:
 *   - 'login'  rows: the one-time sign-in code is minted at SEND time (codes
 *     expire fast, and this way no live credential is ever stored — the row only
 *     holds the address + post-auth destination). One email per request.
 *   - 'digest' rows: the per-user match-day email, pre-rendered. Drained in
 *     batches of up to 100 per Resend request.
 *
 * Single-flight: a drainer claims a lock row (email_drain_lock) before doing any
 * work and releases it after, so at most one drainer runs at a time anywhere.
 * With one drainer active, its in-process request spacing (≥MIN_REQUEST_INTERVAL_MS
 * apart) is globally authoritative — the simplest guarantee we never exceed
 * Resend's 2 req/s. A drain is kicked inline after enqueue (so a lone user, or
 * the first in a burst, gets their code immediately) and every minute by the
 * /api/poll cron (so backlogs keep draining).
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendEmailBatch, isEmailConfigured, type EmailMessage } from "@/lib/email";
import { appBaseUrl } from "@/lib/app-url";

/** Resend's request/second cap. Raise via EMAIL_RATE_PER_SEC once Resend lifts it. */
export function ratePerSec(): number {
  const n = Number(process.env.EMAIL_RATE_PER_SEC);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

/** Minimum gap between two Resend requests, so one drainer stays under the rate. */
function minRequestIntervalMs(): number {
  return Math.ceil(1000 / ratePerSec());
}

/** Messages per Resend batch request — Resend's per-request cap. */
const BATCH_MAX = 100;
/** Cron drains do up to this many requests per run, bounded by the serverless
 *  time budget; the next tick continues any remaining backlog. */
const MAX_REQUESTS_PER_DRAIN = 12;
/** Inline kicks (on a sign-in request) do only a few requests so the HTTP
 *  response stays snappy — the cron handles the bulk. */
export const INLINE_MAX_REQUESTS = 3;
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
 * clears one request per minRequestInterval, sending codes one-per-request and
 * digests up to 100-per-request, oldest first. So the wait is the number of
 * requests ahead of this row — every still-pending sign-in at or before it, plus
 * one request per 100 pending digests ahead — divided by the per-second rate.
 * Deliberately a touch conservative: under-promising and landing early is better.
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

  const requestsAhead =
    Math.max(1, loginAhead ?? 1) + Math.ceil((digestAhead ?? 0) / BATCH_MAX);
  return Math.ceil(requestsAhead / ratePerSec());
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
 * Send up to `maxRequests` Resend requests worth of queued mail, oldest first,
 * pacing requests to stay under the rate. Caller must already hold the drain
 * lock. Each iteration is ONE request: a single sign-in code, or a batch of up
 * to 100 digests. Never throws — a failed send leaves its row pending (or marks
 * it failed past MAX_ATTEMPTS) for the next drain.
 */
async function drainWhileLocked(
  admin: SupabaseClient,
  maxRequests: number,
): Promise<number> {
  const intervalMs = minRequestIntervalMs();
  let sent = 0;
  let requests = 0;
  let lastRequestAt = 0;

  while (requests < maxRequests) {
    const { data: page } = await admin
      .from("email_queue")
      .select(ROW_COLUMNS)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_MAX);
    const rows = (page ?? []) as QueueRow[];
    if (rows.length === 0) break;

    // The next request takes the oldest row's kind: one login code, or up to a
    // full batch of the page's digests.
    const target =
      rows[0].kind === "login"
        ? [rows[0]]
        : rows.filter((r) => r.kind === "digest").slice(0, BATCH_MAX);

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

    // Pace: hold each request to ≥intervalMs after the previous one started.
    if (lastRequestAt > 0) {
      const elapsed = Date.now() - lastRequestAt;
      if (elapsed < intervalMs) await sleep(intervalMs - elapsed);
    }
    lastRequestAt = Date.now();
    requests++;

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
 * the others return immediately. `maxRequests` bounds the work so an inline kick
 * stays snappy (pass INLINE_MAX_REQUESTS) while the cron clears the backlog.
 */
export async function drainEmailQueue(
  maxRequests: number = MAX_REQUESTS_PER_DRAIN,
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
    const sent = await drainWhileLocked(admin, maxRequests);
    return { sent };
  } finally {
    await releaseDrainLock(admin);
  }
}
