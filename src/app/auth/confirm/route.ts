import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { postAuthDest } from "@/lib/profile";

/**
 * Server-side magic-link verification. The email template points here with a
 * `token_hash`; we verify it and set the session cookie. Unlike the hash-
 * fragment (implicit) flow, this works fully server-side, so the user is
 * actually signed in after clicking the link. First-time users (no profile name
 * yet) are sent to /welcome to finish setup; returning users go to `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");

  if (tokenHash && type) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error && data.user) {
      const dest = await postAuthDest(data.user.id, nextParam);
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=1`);
}
