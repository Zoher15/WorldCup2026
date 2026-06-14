import { getPlayerProfile, derivePlayerBadges } from "@/lib/player";
import { renderAchievementsPng } from "@/lib/og-render";
import { OG_DEFAULT_BASE64 } from "@/lib/og-default";

// Serves a player's achievements PNG (the OG/Twitter share image): their points,
// matches predicted, and 🔥 streak / 🎯 exact-score badges within a group. Like
// the per-match image, it renders on demand behind a short CDN cache (these only
// move as results confirm), with no stored-bytes table to migrate. It draws only
// aggregates derived from finished matches, so a not-yet-kicked-off pick is never
// exposed. A render hiccup falls back to the default image so a preview can never
// blank or 500. Runs on Node (default).
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string; userId: string }> },
) {
  const { code, userId } = await params;
  let png: string | null = null;
  try {
    const profile = await getPlayerProfile({ code, userId, viewerId: null });
    if (profile) {
      const badges = derivePlayerBadges(profile.rows);
      png = Buffer.from(
        await renderAchievementsPng({
          displayName: profile.player.displayName,
          groupName: profile.group.name,
          points: profile.summary.points,
          predicted: profile.summary.predicted,
          total: profile.summary.total,
          streak: badges.streak,
          exact: badges.exact,
        }),
      ).toString("base64");
    }
  } catch {
    // fall through to the default
  }
  const bytes = Buffer.from(png ?? OG_DEFAULT_BASE64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
