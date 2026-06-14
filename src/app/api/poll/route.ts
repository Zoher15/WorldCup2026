import { pollIfDue, syncDay } from "@/lib/sync";
import { footballDataDiagnostics } from "@/lib/footballdata";
import { authorizeCron } from "@/lib/cron-auth";
import { drainEmailQueue } from "@/lib/email-queue";
import { drainLoginEmails } from "@/lib/login-queue";

export const dynamic = "force-dynamic";

/**
 * Live-score poll endpoint, meant to be hit frequently (e.g. an every-minute
 * Supabase cron). It self-throttles: it only calls football-data when a match
 * is live and a short de-dupe interval has elapsed. Protected by CRON_SECRET.
 *
 *   GET /api/poll?secret=...                  guarded poll (use this for cron)
 *   GET /api/poll?secret=...&date=YYYY-MM-DD&force=1   force a sync, bypassing the guard
 *   GET /api/poll?secret=...&debug=1          probe football-data's raw response
 *   or send the secret as `Authorization: Bearer <CRON_SECRET>`
 */
async function handle(req: Request): Promise<Response> {
  if (!authorizeCron(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);

  try {
    // Diagnostics: show football-data's raw responses, write nothing.
    if (url.searchParams.get("debug")) {
      return Response.json({ ok: true, debug: true, probes: await footballDataDiagnostics() });
    }

    // Forced sync (manual / backfill), bypassing the live-window guard.
    if (url.searchParams.get("force")) {
      const summary = await syncDay();
      return Response.json({ ok: true, forced: true, ...summary });
    }

    // Drain the shared email queue (sign-in codes + match-day digests) at the
    // rate limit. Independent of the score poll, so a sync failure can't starve
    // the queue (and vice versa). Also drain the legacy login-only queue so any
    // sign-in code queued before this deploy still goes out (transitional).
    const drained = await drainEmailQueue().catch(() => ({ sent: 0 }));
    const legacy = await drainLoginEmails().catch(() => ({ sent: 0 }));

    const result = await pollIfDue();
    return Response.json({ ok: true, emailsSent: drained.sent + legacy.sent, ...result });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
