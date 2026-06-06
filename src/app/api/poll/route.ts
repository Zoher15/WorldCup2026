import { pollIfDue, syncDay } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * Live-score poll endpoint, meant to be hit frequently (e.g. an every-minute
 * Supabase cron). It self-throttles: it only spends an API request when a match
 * is live and the planner's interval has elapsed. Protected by CRON_SECRET.
 *
 *   GET /api/poll?secret=...            budget-aware poll (use this for cron)
 *   GET /api/poll?secret=...&date=YYYY-MM-DD&force=1   force a full sync of a day
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
    // Forced sync of a specific date (manual / backfill), bypassing the guard.
    const force = url.searchParams.get("force");
    const date = url.searchParams.get("date");
    if (force && date) {
      const summary = await syncDay(date);
      return Response.json({ ok: true, forced: true, date, ...summary });
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
