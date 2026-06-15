import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserId } from "@/lib/identity";
import { getProfile } from "@/lib/profile";
import { getGroupInvite, getGroupName } from "@/lib/groups";
import { getPlayerProfile, derivePlayerBadges } from "@/lib/player";
import { achievementOgImageSize } from "@/lib/og-render";
import { InviteJoinForm } from "@/app/_components/InviteJoinForm";

export const dynamic = "force-dynamic";

// Public per-player share landing. The achievements PNG lives at
// /s/<code>/p/<id>/og, declared as this page's OG/Twitter image — so pasting the
// link unfurls into the player's scorecard (points, streak, exact scores).
// Mirrors the leaderboard/match share pages: members go straight to the in-group
// profile, everyone else gets the join prompt, while the metadata still carries
// the image for the always-signed-out preview bots.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string; userId: string }>;
}): Promise<Metadata> {
  const { code, userId } = await params;
  const profile = await getPlayerProfile({ code, userId, viewerId: null });
  const name = profile?.player.displayName ?? "World Cup 2026";
  const groupName = profile?.group.name ?? "World Cup 2026";
  const title = `${name} · ${groupName}`;
  let description =
    "World Cup 2026 score & winner predictions — see the scorecard, then tap in to make your own picks.";
  if (profile) {
    const badges = derivePlayerBadges(profile.rows);
    const bits = [`${profile.summary.points} pts`];
    if (badges.streak >= 2) bits.push(`🔥 ${badges.streak} in a row`);
    if (badges.exact >= 1) bits.push(`🎯 ${badges.exact} exact`);
    description = `${name}'s World Cup 2026 scorecard in ${groupName}: ${bits.join(" · ")}. Tap in to make your own picks.`;
  }
  const image = `/s/${code}/p/${userId}/og`;
  const { width, height } = achievementOgImageSize();
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "World Cup 2026 Predictions",
      images: [{ url: image, width, height, alt: `${name}'s scorecard` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PlayerSharePage({
  params,
}: {
  params: Promise<{ code: string; userId: string }>;
}) {
  const { code, userId } = await params;
  const next = `/s/${code}/p/${userId}`;
  const viewerId = await getUserId();

  // Signed-out visitors (and link-preview bots) get the invite prompt. Signing
  // in returns them here to either join or view the profile.
  if (!viewerId) {
    const name = await getGroupName(code);
    if (!name) notFound();
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="mb-2 gradient-text font-display pb-1 text-3xl leading-tight">
          You&apos;re invited!
        </h1>
        <p className="mb-6 text-sm font-medium text-stone-300">
          Join <strong className="text-violet-300">{name}</strong> to see
          the scorecard and make your own predictions.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="block w-full rounded-full glass py-3.5 text-center text-lg font-bold text-emerald-400 transition active:scale-95"
        >
          Sign in to join →
        </Link>
      </main>
    );
  }

  // Signed in but no profile name yet: finish setup first, then come back.
  const profile = await getProfile(viewerId);
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(next)}`);

  const invite = await getGroupInvite(code, viewerId);
  if (!invite) notFound();

  // Already a member → straight to the in-group player profile.
  if (invite.isMember) redirect(`/g/${code}/p/${userId}`);

  // Signed-in non-member → the join form (same as the invite page).
  return (
    <InviteJoinForm code={code} groupName={invite.name} profileName={profile.name} />
  );
}
