import { authorizeCron } from "@/lib/cron-auth";
import { notifyOpenWindows, nudgeMissingPredictions } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Email cron endpoint, meant to be hit every few minutes. It drives two
 * self-throttling, exactly-once-per-match-day emails:
 *   - the broadcast "predictions are open" announcement (when a day's window
 *     opens), and
 *   - the per-user "you've still got predictions missing" nudge (~2h before a
 *     day's first kickoff, only to members with gaps).
 * Each claims its match-day in its own log before sending, so a coarse interval
 * is fine. Guarded by CRON_SECRET (same secret as /api/poll).
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
