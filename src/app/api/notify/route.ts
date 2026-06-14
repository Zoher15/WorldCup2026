import { authorizeCron } from "@/lib/cron-auth";
import { notifyOpenWindows, nudgeMissingPredictions } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Email cron endpoint, meant to be hit every few minutes. It drives two
 * self-throttling reminder emails:
 *   - the broadcast "predictions are open" announcement, once per match-day when
 *     its window opens, and
 *   - the per-user "you've still got predictions missing" nudge, ONE email ~1h
 *     before a match-day's FIRST kickoff, to members who haven't finished the
 *     day — carrying per-group social proof of who's already in.
 * The announcement claims its match-day (notified_match_days) and the nudge
 * claims the match-day (nudged_match_days) before sending, so a coarse interval
 * is fine and every send is exactly-once. Guarded by CRON_SECRET (same secret as
 * /api/poll).
 *
 *   GET /api/notify?secret=...        or  Authorization: Bearer <CRON_SECRET>
 */
async function handle(req: Request): Promise<Response> {
  if (!authorizeCron(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    // Sequential, not parallel: both sends share Resend's per-second budget, so
    // running them one after the other keeps the staggering in sendEmailBatch
    // authoritative instead of letting their requests overlap.
    const opened = await notifyOpenWindows();
    const nudged = await nudgeMissingPredictions();
    return Response.json({ opened, nudged });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "notify failed" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
