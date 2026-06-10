import { getGroupOgImage, regenerateGroupOgImage } from "@/lib/og-images";
import { OG_DEFAULT_BASE64 } from "@/lib/og-default";

// Serves a group's pre-rendered leaderboard PNG (the OG/Twitter share image).
// This only returns stored bytes — there is no rendering here — so it can never
// blank or 500 the way the old edge `opengraph-image` route did. If a group has
// no stored image yet, it returns the generic branded default, so the link
// always unfurls into a valid picture. Runs on Node (default).
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  let stored: string | null = null;
  try {
    stored = await getGroupOgImage(code);
    // First view of a group that predates this feature (or has no result yet):
    // render its board now, store it, and serve it. Best-effort — if rendering
    // fails we fall back to the default rather than erroring. Later renders are
    // pure byte reads; the poll keeps the stored image fresh as scores move.
    if (!stored) {
      await regenerateGroupOgImage(code);
      stored = await getGroupOgImage(code);
    }
  } catch {
    // fall through to the default
  }
  const bytes = Buffer.from(stored ?? OG_DEFAULT_BASE64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/png",
      // Browsers always revalidate; the edge caches for a few minutes (the poll
      // refreshes the bytes as scores move) and serves stale while refreshing.
      // A short, explicit max-age avoids next/og's default year-long immutable
      // cache, which previously pinned a stale image across deploys.
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
