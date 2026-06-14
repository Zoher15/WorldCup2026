import { authorizeCron } from "@/lib/cron-auth";
import { sendMatchDayDigest } from "@/lib/notify";
import { drainEmailQueue } from "@/lib/email-queue";

export const dynamic = "force-dynamic";

/**
 * Email cron endpoint, meant to be hit every few minutes. When a match-day's
 * prediction window opens it enqueues ONE consolidated digest per opted-in
 * member — the day's open matches, the picks they're still missing, and
 * per-group social proof of who's already in. The match-day is claimed in
 * notified_match_days before enqueuing, so a coarse interval is fine and every
 * day's digest is enqueued exactly once. We then kick the shared email-queue
 * drainer so the digest starts going out promptly (the every-minute /api/poll
 * cron keeps draining any backlog). Guarded by CRON_SECRET (same as /api/poll).
 *
 *   GET /api/notify?secret=...        or  Authorization: Bearer <CRON_SECRET>
 */
async function handle(req: Request): Promise<Response> {
  if (!authorizeCron(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const digest = await sendMatchDayDigest();
    const drained = await drainEmailQueue().catch(() => ({ sent: 0 }));
    return Response.json({ digest, drained });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "notify failed" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
