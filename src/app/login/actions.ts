"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import type { LoginState } from "./login-state";

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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://worldcup.kachwalas.com";
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
