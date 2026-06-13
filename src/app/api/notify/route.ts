import { authorizeCron } from "@/lib/cron-auth";
import { notifyOpenWindows, nudgeMissingPredictions } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Email cron endpoint, meant to be hit every few minutes. It drives two
 * self-throttling reminder emails:
 *   - the broadcast "predictions are open" announcement, once per match-day when
 *     its window opens, and
 *   - the per-user "you've still got a prediction missing" nudge, ~1h before
 *     EACH match's kickoff, only to members missing that specific game.
 * The announcement claims its match-day (notified_match_days) and the nudge
 * claims each match (nudged_matches) before sending, so a coarse interval is
 * fine and every send is exactly-once. Guarded by CRON_SECRET (same secret as
 * /api/poll).
 *
 *   GET /api/notify?secret=...        or  Authorization: Bearer <CRON_SECRET>
 */
async function handle(req: Request): Promise<Response> {
  if (!authorizeCron(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const [opened, nudged] = await Promise.all([
      notifyOpenWindows(),
      nudgeMissingPredictions(),
    ]);
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
