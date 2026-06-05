import { cookies } from "next/headers";

/**
 * Lightweight device identity: a single httpOnly cookie holds the user's id.
 * No passwords. A user reclaims their identity on a new device with their
 * recovery code (see lib/codes and the recover flow).
 */
const UID_COOKIE = "wc_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(UID_COOKIE)?.value ?? null;
}

export async function setUserId(id: string): Promise<void> {
  const store = await cookies();
  store.set(UID_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}
