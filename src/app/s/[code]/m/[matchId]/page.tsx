import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserId } from "@/lib/identity";
import { getProfile } from "@/lib/profile";
import { getGroupInvite, getGroupName } from "@/lib/groups";
import { getMatchLeaderboard } from "@/lib/match-leaderboard";
import { matchOgImageSize } from "@/lib/og-render";
import { teamLabel } from "@/lib/fifa";
import { InviteJoinForm } from "@/app/_components/InviteJoinForm";

export const dynamic = "force-dynamic";

// Public per-match share landing. The board PNG lives at /s/<code>/m/<id>/og,
// declared as this page's OG/Twitter image — so pasting the link into a chat
// unfurls into the fixture and everyone's predictions. Mirrors the leaderboard
// share page (/s/<code>): the link is handed around to people who may or may not
// be in the group, so the page acts like the invite (members go straight to the
// match board, everyone else gets the join prompt), while the metadata still
// carries the image for the always-signed-out preview bots.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string; matchId: string }>;
}): Promise<Metadata> {
  const { code, matchId } = await params;
  const board = await getMatchLeaderboard({ code, matchId, viewerId: null });
  const home = board ? teamLabel(board.match.homeCode, board.match.homeLabel) : null;
  const away = board ? teamLabel(board.match.awayCode, board.match.awayLabel) : null;
  const fixture = home && away ? `${home} v ${away}` : "Match predictions";
  const groupName = board?.group.name ?? "World Cup 2026";
  const title = `${fixture} · ${groupName}`;
  const description = board
    ? `See how everyone in ${groupName} called ${fixture} — World Cup 2026 score & winner predictions. Tap in to make your own picks.`
    : "World Cup 2026 score & winner predictions — see everyone's picks, then tap in to make your own.";
  const image = `/s/${code}/m/${matchId}/og`;
  const { width, height } = matchOgImageSize(board?.rows.length ?? 0);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "World Cup 2026 Predictions",
      images: [{ url: image, width, height, alt: `${fixture} predictions` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function MatchSharePage({
  params,
}: {
  params: Promise<{ code: string; matchId: string }>;
}) {
  const { code, matchId } = await params;
  const next = `/s/${code}/m/${matchId}`;
  const userId = await getUserId();

  // Signed-out visitors (and link-preview bots) get the invite prompt. Signing
  // in returns them here to either join or view the match board.
  if (!userId) {
    const name = await getGroupName(code);
    if (!name) notFound();
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="mb-2 gradient-text font-display pb-1 text-3xl leading-tight">
          You&apos;re invited!
        </h1>
        <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
          Join <strong className="text-grape dark:text-violet-300">{name}</strong> to see
          everyone&apos;s predictions and make your own.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="block w-full rounded-full glass py-3.5 text-center text-lg font-bold text-pitch transition active:scale-95 dark:text-emerald-400"
        >
          Sign in to join →
        </Link>
      </main>
    );
  }

  // Signed in but no profile name yet: finish setup first, then come back.
  const profile = await getProfile(userId);
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(next)}`);

  const invite = await getGroupInvite(code, userId);
  if (!invite) notFound();

  // Already a member → straight to the live match board.
  if (invite.isMember) redirect(`/g/${code}/m/${matchId}`);

  // Signed-in non-member → the join form (same as the invite page).
  return (
    <InviteJoinForm code={code} groupName={invite.name} profileName={profile.name} />
  );
}
