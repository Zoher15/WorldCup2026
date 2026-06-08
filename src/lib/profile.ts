import { createAdminClient } from "./supabase/admin";

export interface Profile {
  id: string;
  name: string;
}

/** The app-level profile (display name) for an authenticated user, or null. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("users")
    .select("id, real_name")
    .eq("id", userId)
    .single();
  return data ? { id: data.id, name: data.real_name } : null;
}

/** Create or update the user's profile name (keyed by the auth user id). */
export async function upsertProfile(
  userId: string,
  name: string,
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("users")
    .upsert({ id: userId, real_name: name }, { onConflict: "id" });
  if (error) throw new Error(`Could not save your profile: ${error.message}`);
}

/**
 * Two-letter initials for the avatar: first + last word, so "Zoher Kachwala"
 * -> "ZK" and a single name -> its first two letters.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
