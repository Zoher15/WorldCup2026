"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/identity";
import { deleteGroup, removeMember } from "@/lib/groups";

/** Delete the whole group (admin only), then go to the groups list. */
export async function deleteGroupAction(code: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  await deleteGroup(code, userId);
  redirect("/groups");
}

/** Remove a member from the group (admin only). */
export async function removeMemberAction(
  code: string,
  targetUserId: string,
): Promise<void> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  await removeMember(code, userId, targetUserId);
  revalidatePath(`/g/${code}`);
}
