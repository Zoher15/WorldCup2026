"use server";

import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { upsertProfile } from "@/lib/profile";
import type { WelcomeState } from "./welcome-state";

export async function saveNameAction(
  _prev: WelcomeState,
  form: FormData,
): Promise<WelcomeState> {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const name = String(form.get("name") ?? "").trim();
  const nextParam = String(form.get("next") ?? "/");
  const next = nextParam.startsWith("/") ? nextParam : "/";

  if (!name) return { error: "Please enter your name." };

  await upsertProfile(userId, name);
  redirect(next);
}
