import { ensureGroupOgImage } from "@/lib/og-images";
import { OG_DEFAULT_BASE64 } from "@/lib/og-default";

// Serves a group's leaderboard PNG (the OG/Twitter share image). ensureGroupOgImage
// hashes the live standings and re-renders only when the board actually changed
// (a join, a rename, a confirmed result) or the layout version bumped — otherwise
// it's a hash compare over a few light queries, no render. The CDN cache below
// throttles origin hits to ~once/5min/group, so crawlers and viral unfurls stay
// cheap, and a render failure falls back to the previous bytes (or the default),
// so a preview can never blank or 500. Runs on Node (default).
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  let png: string | null = null;
  try {
    png = (await ensureGroupOgImage(code))?.pngBase64 ?? null;
  } catch {
    // fall through to the default
  }
  const bytes = Buffer.from(png ?? OG_DEFAULT_BASE64, "base64");
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
