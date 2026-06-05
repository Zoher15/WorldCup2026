"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client using the public anon key. Used for read-only,
 * realtime subscriptions (live scores, leaderboard updates) under RLS. Never
 * used for privileged writes — those go through server actions.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase public env vars are not configured " +
        "(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return createBrowserClient(url, key);
}
