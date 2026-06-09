/**
 * Shared guard for cron-triggered endpoints (live-score poll, daily email).
 * Accepts the secret either as a `?secret=` query param or an
 * `Authorization: Bearer <secret>` header, matching CRON_SECRET.
 */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const provided =
    new URL(request.url).searchParams.get("secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  return Boolean(secret) && provided === secret;
}
