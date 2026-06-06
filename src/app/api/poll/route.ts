import { pollIfDue, syncDay } from "@/lib/sync";
import { footballDataDiagnostics } from "@/lib/footballdata";

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
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const provided =
    url.searchParams.get("secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  if (!secret || provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

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

    const result = await pollIfDue();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
