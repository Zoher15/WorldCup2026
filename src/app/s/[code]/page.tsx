import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserId } from "@/lib/identity";
import { getProfile } from "@/lib/profile";
import { getGroupInvite, getGroupName, getGroupStandings } from "@/lib/groups";
import { ogImageSize } from "@/lib/og-render";
import { InviteJoinForm } from "@/app/_components/InviteJoinForm";

export const dynamic = "force-dynamic";

// Public share landing. The leaderboard PNG lives in opengraph-image.tsx in this
// same segment, which Next automatically wires up as this page's OG/Twitter
// image — so pasting /s/<code> into a chat unfurls into the podium picture.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const data = await getGroupStandings(code);
  const name = data?.group.name ?? "World Cup 2026";
  const title = `${name} · Leaderboard`;
  const description =
    "World Cup 2026 score & winner predictions — see who's topping the leaderboard, then tap in to make your own picks.";
  // The share image is served from /s/<code>/og — pre-rendered bytes stored by
  // the poll (and on group creation), never rendered on the crawler's request.
  // Its height grows with the group, so declare the matching size here (the
  // renderer and this share the same ogImageSize()).
  const image = `/s/${code}/og`;
  const { width, height } = ogImageSize(data?.standings.overall.length ?? 0);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "World Cup 2026 Predictions",
      images: [{ url: image, width, height, alt: "World Cup 2026 leaderboard" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

// The shared link is handed around to people who may or may not be in the group,
// so the page acts like the invite: members are sent straight to the live
// leaderboard, everyone else gets the join prompt. (The OG metadata above still
// carries the leaderboard image, so the link unfurls into the podium regardless
// — preview bots are always signed-out and just read the head.)
export default async function SharePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const userId = await getUserId();

  // Signed-out visitors (and link-preview bots) get the invite prompt. Signing
  // in returns them here to either join or view the standings.
  if (!userId) {
    const name = await getGroupName(code);
    if (!name) notFound();
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="mb-2 gradient-text font-display pb-1 text-3xl leading-tight">
          You&apos;re invited!
        </h1>
        <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
          Join <strong className="text-grape dark:text-violet-300">{name}</strong> and
          start predicting World Cup 2026 matches.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/s/${code}`)}`}
          className="block w-full rounded-full glass py-3.5 text-center text-lg font-bold text-pitch transition active:scale-95 dark:text-emerald-400"
        >
          Sign in to join →
        </Link>
      </main>
    );
  }

  // Signed in but no profile name yet: finish setup first, then come back.
  const profile = await getProfile(userId);
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(`/s/${code}`)}`);

  const invite = await getGroupInvite(code, userId);
  if (!invite) notFound();

  // Already a member → straight to the live leaderboard.
  if (invite.isMember) redirect(`/g/${code}`);

  // Signed-in non-member → the join form (same as the invite page).
  return (
    <InviteJoinForm code={code} groupName={invite.name} profileName={profile.name} />
  );
}
