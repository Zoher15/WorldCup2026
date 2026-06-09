"use server";

import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getProfile } from "@/lib/profile";
import { joinGroupByCode } from "@/lib/groups";

/** Accept a group invite: join by code (using the optional nickname), then go
 *  to the group. Auth + profile are guaranteed by the invite page, but we
 *  re-check here since this runs server-side. */
export async function acceptInviteAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  const userId = await getUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/i/${code}`)}`);

  const profile = await getProfile(userId);
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(`/i/${code}`)}`);

  await joinGroupByCode({ userId, code, displayName: displayName || profile.name });
  redirect(`/g/${code}`);
}
