import { authorizeCron } from "@/lib/cron-auth";
import { notifyOpenWindows } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Daily "predictions are open" email endpoint, meant to be hit by the cron every
 * few minutes. It self-throttles: it emails a match-day only once, and only
 * while its window is open and the first kickoff is still ahead. Guarded by
 * CRON_SECRET (same secret as /api/poll).
 *
 *   GET /api/notify?secret=...        or  Authorization: Bearer <CRON_SECRET>
 */
async function handle(req: Request): Promise<Response> {
  if (!authorizeCron(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const result = await notifyOpenWindows();
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "notify failed" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
