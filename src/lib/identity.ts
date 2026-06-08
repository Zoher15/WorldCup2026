import { createServerSupabase } from "./supabase/server";

/**
 * Identity is Supabase Auth (email magic-link). The signed-in user's id is the
 * app's user id (== auth.uid()) and the key for memberships, predictions, and
 * the profile row in `users`.
 *
 * Both helpers fail open (return null) if Supabase auth isn't configured yet,
 * so the site still renders in a logged-out state during setup rather than
 * crashing every page.
 */
export async function getAuthUser() {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function getUserId(): Promise<string | null> {
  const user = await getAuthUser();
  return user?.id ?? null;
}
