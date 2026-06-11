"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { appBaseUrl } from "@/lib/app-url";
import { postAuthDest } from "@/lib/profile";
import type { LoginState, VerifyState } from "./login-state";

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

  const appUrl = appBaseUrl();
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { status: "error", error: error.message };
  return { status: "sent", email };
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
  if (token.length !== 6) {
    return { status: "error", error: "Enter the 6-digit code from your email." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error || !data.user) {
    return {
      status: "error",
      error: "That code didn't work — double-check it, or request a new one.",
    };
  }

  const dest = await postAuthDest(data.user.id, next);
  redirect(dest);
}
