"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured } from "@/lib/email";
import {
  enqueueLoginEmail,
  drainLoginEmails,
  loginEmailStatus,
  estimateEtaSeconds,
} from "@/lib/login-queue";
import { postAuthDest } from "@/lib/profile";
import type { LoginState, VerifyState } from "./login-state";

/** Minimum gap between sign-in codes for one address, so repeated "Resend" taps
 *  can't burn through the email provider's send limits. */
const CODE_COOLDOWN_MS = 2 * 60 * 1000;

/** A friendly wait, e.g. "47 seconds" or "1 min 12s". */
function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const s = seconds % 60;
  return s ? `${Math.floor(seconds / 60)} min ${s}s` : `${Math.floor(seconds / 60)} min`;
}

/**
 * Request a 6-digit sign-in code. Rather than POST to Resend inline (which melts
 * down when many people sign in at once — Resend caps us at a few sends per
 * minute, so the surplus 429s and fails), we queue the request and let the
 * rate-limited drainer (src/lib/login-queue.ts) mint and send the code. We kick
 * the drainer inline straight after queueing, so a lone user — or the first few
 * in a rush — still get their code right away; everyone behind them gets an
 * estimate of when theirs will land, computed from their place in the queue.
 *
 * Resends for one address are throttled to CODE_COOLDOWN_MS apart — a user
 * mashing "Resend" shouldn't pile duplicate requests into the queue. The throttle
 * is keyed by email in login_code_requests (server-enforced, so it holds across
 * tabs and devices, not just this browser).
 */
export async function sendMagicLinkAction(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = String(form.get("next") ?? "/");
  if (!email || !email.includes("@")) {
    return { status: "error", error: "Enter a valid email address." };
  }
  if (!isEmailConfigured()) {
    return {
      status: "error",
      error: "Email isn't configured on the server yet. Please try again later.",
    };
  }

  const admin = createAdminClient();

  // Throttle: refuse a new code while the last one for this address is still
  // within the cooldown. Reads/writes go through the service role. (If the table
  // isn't there yet the read just returns nothing and we fall through — the
  // throttle fails open rather than locking anyone out.)
  const { data: last } = await admin
    .from("login_code_requests")
    .select("last_sent_at")
    .eq("email", email)
    .maybeSingle();
  if (last?.last_sent_at) {
    const remainingMs =
      CODE_COOLDOWN_MS - (Date.now() - Date.parse(last.last_sent_at as string));
    if (remainingMs > 0) {
      const seconds = Math.ceil(remainingMs / 1000);
      return {
        status: "sent",
        email,
        retryAfter: seconds,
        error: `You just requested a code — you can ask for another in ${formatWait(seconds)}.`,
      };
    }
  }

  // Queue the request (the code is minted later, at send time) and record the
  // send so the cooldown throttles the next request for this email.
  let id: number;
  try {
    ({ id } = await enqueueLoginEmail(email, next));
  } catch {
    return {
      status: "error",
      error: "Couldn't send your code right now — please try again in a moment.",
    };
  }
  await admin
    .from("login_code_requests")
    .upsert({ email, last_sent_at: new Date().toISOString() });

  // Kick the drainer inline so a lone user (or the first few in a burst) get
  // their code immediately instead of waiting for the next cron tick.
  await drainLoginEmails();

  // If this request's code already went out, no need to set expectations.
  if ((await loginEmailStatus(id)) === "sent") {
    return { status: "sent", email };
  }

  // Still queued behind others — tell the user roughly when it'll arrive.
  return { status: "sent", email, etaSeconds: await estimateEtaSeconds(id) };
}

/**
 * Verify the 6-digit code from the magic-link email. Unlike clicking the link
 * (which opens — and signs you in on — the device's *default* browser, and whose
 * PKCE verifier only lives in the browser that requested it), entering the code
 * signs you in right here, in the same browser the user is already in. That's
 * the whole point: no cross-browser "stuck" state.
 */
export async function verifyEmailOtpAction(
  _prev: VerifyState,
  form: FormData,
): Promise<VerifyState> {
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const token = String(form.get("token") ?? "").replace(/\D/g, "");
  const next = String(form.get("next") ?? "/");
  // Supabase's email OTP length is a project setting (6–10 digits); accept the
  // whole range rather than hard-coding one length.
  if (token.length < 6 || token.length > 10) {
    return { status: "error", error: "Enter the code from your email." };
  }

  const supabase = await createServerSupabase();
  // A returning user's code is an "email" (magic-link) OTP; a brand-new user's
  // code is a "signup" confirmation OTP. We can't tell which from here, and the
  // 6-digit token is the same either way, so try the magic-link type first and
  // fall back to signup. Both verify the same token, so the fallback is safe.
  let { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error || !data.user) {
    ({ data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    }));
  }
  if (error || !data.user) {
    return {
      status: "error",
      error: "That code didn't work — double-check it, or request a new one.",
    };
  }

  const dest = await postAuthDest(data.user.id, next);
  redirect(dest);
}
