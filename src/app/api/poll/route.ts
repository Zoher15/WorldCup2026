import { syncDay } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * Live-score poll endpoint. Called by a scheduler (Supabase cron / external
 * cron) on the interval chosen by the polling planner. Protected by CRON_SECRET
 * so only our scheduler can trigger it.
 *
 *   GET /api/poll?secret=...&date=YYYY-MM-DD   (date optional, defaults to today UTC)
 *   or Authorization: Bearer <CRON_SECRET>
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

  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  try {
    const summary = await syncDay(date);
    return Response.json({ ok: true, date, ...summary });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
