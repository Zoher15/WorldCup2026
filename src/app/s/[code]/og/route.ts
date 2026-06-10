import { getGroupOgImage, regenerateGroupOgImage } from "@/lib/og-images";
import { OG_RENDER_VERSION } from "@/lib/og-render";
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
  let png: string | null = null;
  try {
    const stored = await getGroupOgImage(code);
    // Render now when there's nothing stored (a group predating this feature, or
    // with no result yet) or when the stored image is from an older layout
    // (render_version bumped). Best-effort — a render failure falls back to the
    // default rather than erroring. Otherwise it's a pure byte read; the poll
    // keeps the stored image fresh as scores move.
    if (!stored || stored.renderVersion !== OG_RENDER_VERSION) {
      await regenerateGroupOgImage(code);
      png = (await getGroupOgImage(code))?.pngBase64 ?? stored?.pngBase64 ?? null;
    } else {
      png = stored.pngBase64;
    }
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
