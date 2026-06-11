"use server";

import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { upsertProfile } from "@/lib/profile";
import { safeNextPath } from "@/lib/redirect";
import type { WelcomeState } from "./welcome-state";

export async function saveNameAction(
  _prev: WelcomeState,
  form: FormData,
): Promise<WelcomeState> {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const first = String(form.get("firstName") ?? "").trim();
  const last = String(form.get("lastName") ?? "").trim();
  const next = safeNextPath(String(form.get("next") ?? "/"));

  if (!first || !last) {
    return { error: "Please enter your first and last name." };
  }

  // Stored as the user's real name; each group can still override it with a
  // per-group nickname when joining.
  const name = `${first} ${last}`.replace(/\s+/g, " ");
  await upsertProfile(userId, name);
  redirect(next);
}
