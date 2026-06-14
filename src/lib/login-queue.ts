/**
 * Rate-limited queue for sign-in code emails.
 *
 * Resend caps us at a few sends per minute, but sign-ins arrive whenever people
 * show up — and during a match-day rush that's many at once. Sending inline meant
 * everything past the limit hit a 429 and, once the short retry budget ran out,
 * failed outright. So we queue the *intent* (login_email_queue) and drain it in
 * FIFO order at the provider's rate.
 *
 * The OTP is minted at SEND time, not enqueue time: codes expire fast, and this
 * way no live credential is ever stored — the queue row only holds the address
 * and the post-auth destination.
 *
 * drainLoginEmails is both kicked inline right after an enqueue (so a lone user,
 * or the first few in a burst, get their code immediately) and run every minute
 * by the /api/poll cron (so the rest of a backlog keeps draining). A DB-backed
 * rate gate keeps the two from collectively overshooting the limit; the 429 retry
 * in email.ts is the backstop for the rare race, and a row that can't go out is
 * left pending for the next drain rather than lost.
 */
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { appBaseUrl } from "@/lib/app-url";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Sends allowed per rolling minute — Resend's cap. Override per environment via
 *  LOGIN_EMAIL_RATE_PER_MIN (e.g. raise it once Resend lifts your limit). */
export function ratePerMin(): number {
  const n = Number(process.env.LOGIN_EMAIL_RATE_PER_MIN);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

/** Give up on a row after this many failed send attempts. */
const MAX_ATTEMPTS = 5;
/** Reclaim a row stuck in 'sending' (drainer crashed mid-send) after this long. */
const CLAIM_TTL_MS = 2 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface QueueRow {
  id: number;
  email: string;
  next: string;
  attempts: number;
}

/** The sign-in email: the 6-digit code front and centre (entered in the code box,
 *  works in any browser), with a one-tap link fallback that verifies server-side
 *  (/auth/confirm), so it also works cross-browser. */
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

/** Mint a fresh one-time code for this address and email it. Existing user → a
 *  "magiclink" code; brand-new one → a "signup" code (with a throwaway password it
 *  never uses). Throws if the code can't be minted or the send fails, so the
 *  caller can leave the row pending for a retry. */
async function sendOneCode(admin: SupabaseClient, row: QueueRow): Promise<void> {
  let res = await admin.auth.admin.generateLink({ type: "magiclink", email: row.email });
  if (res.error || !res.data?.properties?.email_otp) {
    res = await admin.auth.admin.generateLink({
      type: "signup",
      email: row.email,
      password: randomUUID(),
    });
  }
  const props = res.data?.properties;
  if (res.error || !props?.email_otp) {
    throw new Error("Could not mint a sign-in code.");
  }

  const link =
    `${appBaseUrl()}/auth/confirm?token_hash=${props.hashed_token}` +
    `&type=${props.verification_type}&next=${encodeURIComponent(row.next)}`;
  await sendEmail({
    to: row.email,
    subject: `Your World Cup 2026 sign-in code: ${props.email_otp}`,
    html: codeEmailHtml(props.email_otp, link),
  });
}

/**
 * Add a sign-in request to the queue. Returns the new row id so the caller can
 * kick a drain and then check whether this particular code went out immediately.
 */
export async function enqueueLoginEmail(
  email: string,
  next: string,
): Promise<{ id: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("login_email_queue")
    .insert({ email, next })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Could not queue sign-in email: ${error?.message ?? "no row"}`);
  }
  return { id: data.id as number };
}

/** Status of a queued row, or null if it's gone. */
export async function loginEmailStatus(id: number): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("login_email_queue")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  return (data?.status as string | undefined) ?? null;
}

/**
 * Estimate, in seconds, when the code for queue row `id` will land. The drainer
 * clears `ratePerMin()` rows per minute in FIFO order, so a row in position P
 * goes out after ceil(P / rate) drain cycles. Cycles are driven by the
 * every-minute cron, so each cycle is ~1 minute — which also folds in the
 * worst-case wait for the next tick. Deliberately a touch conservative: under-
 * promising and landing early beats the reverse.
 */
export async function estimateEtaSeconds(id: number): Promise<number> {
  const admin = createAdminClient();
  // Position = how many still-pending rows are at or ahead of this one (ids are
  // monotonic, so id order == enqueue order).
  const { count } = await admin
    .from("login_email_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("id", id);
  const position = Math.max(1, count ?? 1);
  return Math.ceil(position / ratePerMin()) * 60;
}

/**
 * Send as many queued codes as the per-minute budget allows, oldest first.
 * Idempotent and safe to run concurrently (inline kick + cron): each row is
 * claimed with a conditional update so it can't be sent twice, and the budget is
 * computed from rows actually sent in the last 60s. Never throws — a failed send
 * leaves its row pending (or marks it failed past MAX_ATTEMPTS) for the next run.
 */
export async function drainLoginEmails(): Promise<{ sent: number }> {
  if (!isEmailConfigured()) return { sent: 0 };
  const admin = createAdminClient();

  // Reclaim rows orphaned in 'sending' by a crashed drainer.
  await admin
    .from("login_email_queue")
    .update({ status: "pending" })
    .eq("status", "sending")
    .lt("claimed_at", new Date(Date.now() - CLAIM_TTL_MS).toISOString());

  // Budget: rate minus what's already gone out this rolling minute.
  const { count: recent } = await admin
    .from("login_email_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", new Date(Date.now() - 60_000).toISOString());
  const budget = ratePerMin() - (recent ?? 0);
  if (budget <= 0) return { sent: 0 };

  const { data: rows } = await admin
    .from("login_email_queue")
    .select("id,email,next,attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(budget);

  let sent = 0;
  for (const row of (rows ?? []) as QueueRow[]) {
    // Claim it: only one drainer wins the conditional update.
    const { data: claimed } = await admin
      .from("login_email_queue")
      .update({ status: "sending", claimed_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    try {
      await sendOneCode(admin, row);
      await admin
        .from("login_email_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch {
      const attempts = (row.attempts ?? 0) + 1;
      await admin
        .from("login_email_queue")
        .update({ status: attempts >= MAX_ATTEMPTS ? "failed" : "pending", attempts })
        .eq("id", row.id);
    }
    // Small spacing so two sends in one drain don't trip a per-second sub-limit.
    if (sent < budget) await sleep(600);
  }
  return { sent };
}
