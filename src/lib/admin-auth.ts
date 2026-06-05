import { cookies } from "next/headers";

/**
 * Minimal site-admin gate for entering results. Results are global (one
 * `matches` table for everyone), so this is a SITE admin — distinct from a
 * group's `is_admin` member. Access is granted by a shared passcode set in the
 * ADMIN_PASSCODE env var; on success we store a hash of it in an httpOnly
 * cookie. If ADMIN_PASSCODE is unset, admin access is disabled entirely.
 */
const ADMIN_COOKIE = "wc_admin";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function passcode(): string | null {
  return process.env.ADMIN_PASSCODE || null;
}

export async function isAdmin(): Promise<boolean> {
  const pc = passcode();
  if (!pc) return false;
  const store = await cookies();
  const cookie = store.get(ADMIN_COOKIE)?.value;
  return cookie != null && cookie === (await sha256(pc));
}

/** Returns true and sets the admin cookie when the passcode matches. */
export async function signInAdmin(input: string): Promise<boolean> {
  const pc = passcode();
  if (!pc || input !== pc) return false;
  const store = await cookies();
  store.set(ADMIN_COOKIE, await sha256(pc), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  return true;
}

export async function signOutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
