"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/identity";
import { deleteGroup, leaveGroup, removeMember, renameGroup } from "@/lib/groups";

/** Delete the whole group (admin only), then go to the groups list. */
export async function deleteGroupAction(code: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  await deleteGroup(code, userId);
  redirect("/groups");
}

export interface RenameState {
  ok: boolean;
  error?: string;
}

/** Rename the group (admin only). */
export async function renameGroupAction(
  code: string,
  name: string,
): Promise<RenameState> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Please sign in first." };
  try {
    await renameGroup(code, userId, name);
    revalidatePath(`/g/${code}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Leave the group (any member except the creator), then go to the groups list. */
export async function leaveGroupAction(code: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  await leaveGroup(code, userId);
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
