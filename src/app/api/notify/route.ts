import { authorizeCron } from "@/lib/cron-auth";
import { sendMatchDayDigest } from "@/lib/notify";
import { drainEmailQueue } from "@/lib/email-queue";

export const dynamic = "force-dynamic";

/**
 * Email cron endpoint, meant to be hit every few minutes. About an hour before
 * a match-day's first kickoff it enqueues ONE consolidated digest per opted-in
 * member — the day's matches with their picks marked, what they're still
 * missing, how far they've climbed, and per-group social proof of who's already
 * in. The match-day is claimed in notified_match_days before enqueuing, so a
 * coarse interval is fine and every day's digest is enqueued exactly once. We
 * then kick the shared email-queue drainer so the digest starts going out
 * promptly (the every-minute /api/poll cron keeps draining any backlog). Guarded
 * by CRON_SECRET (same as /api/poll).
 *
 *   GET /api/notify?secret=...        or  Authorization: Bearer <CRON_SECRET>
 *
 * Optional `at=<ISO 8601>` overrides the clock used ONLY to decide which
 * match-day is due — an operator escape hatch to force-send a day's digest after
 * its normal 1h-pre-kickoff window has passed (e.g. one that never went out).
 * Pass a time inside that day's window, e.g. ~30 min before its first kickoff.
 * It's still claimed once in notified_match_days, so it can't double-send, and
 * standings / picks / "still missing" are always computed against real now.
 *
 *   GET /api/notify?secret=...&at=2026-06-15T15:30:00Z
 */
async function handle(req: Request): Promise<Response> {
  if (!authorizeCron(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const at = new URL(req.url).searchParams.get("at");
    let now: Date | undefined;
    if (at) {
      now = new Date(at);
      if (Number.isNaN(now.getTime())) {
        return Response.json(
          { ok: false, error: `invalid 'at' timestamp: ${at}` },
          { status: 400 },
        );
      }
    }
    const digest = await sendMatchDayDigest(now);
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
