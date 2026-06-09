import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe from notification emails. The opaque token (per-user,
 * not the user id) flips email_opt_out so nothing personal is exposed in the
 * link. Always returns a friendly page, even for an unknown token.
 */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    try {
      const db = createAdminClient();
      await db.from("users").update({ email_opt_out: true }).eq("unsubscribe_token", token);
    } catch {
      // Best-effort: still show the confirmation page below.
    }
  }

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917;">
    <div style="max-width:420px;margin:0 auto;padding:64px 24px;text-align:center;">
      <div style="font-size:40px;">✅</div>
      <h1 style="margin:12px 0 4px;font-size:22px;">You're unsubscribed</h1>
      <p style="margin:0 0 24px;color:#57534e;font-size:15px;">
        You won't get any more "predictions are open" emails. You can still
        predict and check standings anytime in the app.
      </p>
      <a href="/" style="display:inline-block;background:#0b8a3e;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:9999px;">
        Back to World Cup 2026
      </a>
    </div>
  </body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
