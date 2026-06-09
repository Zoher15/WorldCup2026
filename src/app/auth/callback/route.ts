import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";

/**
 * Magic-link landing: Supabase redirects here with a one-time `code` which we
 * exchange for a session (sets the auth cookies). First-time users (no profile
 * name yet) are sent to /welcome to finish setup; returning users go to `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") ? nextParam : "/";

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const profile = await getProfile(data.user.id);
      const dest = profile
        ? next
        : `/welcome?next=${encodeURIComponent(next)}`;
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=1`);
}

