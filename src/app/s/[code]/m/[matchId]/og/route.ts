import { getMatchLeaderboard } from "@/lib/match-leaderboard";
import { renderMatchPng } from "@/lib/og-render";
import { OG_DEFAULT_BASE64 } from "@/lib/og-default";

// Serves a group's per-match board PNG (the OG/Twitter share image). Unlike the
// leaderboard image (pre-rendered and stored), a match board changes little — the
// picks freeze at kickoff and the score only moves while it's live — so this
// renders on demand behind the short CDN cache below, with no stored-bytes table
// to migrate. getMatchLeaderboard applies the same privacy rule as the page (a
// pick stays hidden until the match locks), so a pre-kickoff preview never leaks
// anyone's scoreline. A render hiccup falls back to the default image so a
// preview can never blank or 500. Runs on Node (default).
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string; matchId: string }> },
) {
  const { code, matchId } = await params;
  let png: string | null = null;
  try {
    const board = await getMatchLeaderboard({ code, matchId, viewerId: null });
    if (board) {
      png = Buffer.from(await renderMatchPng(board)).toString("base64");
    }
  } catch {
    // fall through to the default
  }
  const bytes = Buffer.from(png ?? OG_DEFAULT_BASE64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/png",
      // Browsers always revalidate; the edge caches for a few minutes (the poll
      // moves a live score) and serves stale while refreshing.
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
