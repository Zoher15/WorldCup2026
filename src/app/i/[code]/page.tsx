import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getProfile } from "@/lib/profile";
import { getGroupInvite, getGroupName } from "@/lib/groups";
import { InviteJoinForm } from "@/app/_components/InviteJoinForm";

export const dynamic = "force-dynamic";

// Put the group name in the link preview (iMessage/WhatsApp/social unfurls).
// Runs unauthenticated so preview bots get the name too.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const name = await getGroupName(code);
  const title = name
    ? `Join “${name}” — World Cup 2026`
    : "World Cup 2026 group invite";
  const description = name
    ? `You're invited to join “${name}” and predict every World Cup 2026 match. Think you know ball?`
    : "Join a World Cup 2026 prediction group.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

function InvalidInvite() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="text-4xl">🤷</div>
      <h1 className="mt-3 text-xl font-black text-stone-100">
        That invite link isn&apos;t valid
      </h1>
      <p className="mt-2 text-sm font-medium text-stone-300">
        Double-check the link, or ask for the group code.
      </p>
      <Link
        href="/join"
        className="mt-6 inline-block rounded-full glass px-6 py-3 font-bold text-emerald-400 transition active:scale-95"
      >
        Join with a code
      </Link>
    </main>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const userId = await getUserId();

  // Signed-out visitors (including link-preview bots) get a real page showing
  // who's inviting them — not a redirect, which would strip the unfurl and hide
  // the group name. Signing in returns them here to finish joining.
  if (!userId) {
    const name = await getGroupName(code);
    if (!name) return <InvalidInvite />;
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="mb-2 gradient-text font-display pb-1 text-3xl leading-tight tracking-tight">
          You&apos;re invited!
        </h1>
        <p className="mb-6 text-sm font-medium text-stone-300">
          Join <strong className="text-violet-300">{name}</strong> and
          start predicting World Cup 2026 matches.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/i/${code}`)}`}
          className="block w-full rounded-full glass py-3.5 text-center text-lg font-bold text-emerald-400 transition active:scale-95"
        >
          Sign in to join →
        </Link>
      </main>
    );
  }

  // Signed in but no profile name yet: finish setup first, then come back.
  const profile = await getProfile(userId);
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(`/i/${code}`)}`);

  const invite = await getGroupInvite(code, userId);
  if (!invite) return <InvalidInvite />;

  // Already in? Straight to the group.
  if (invite.isMember) redirect(`/g/${code}`);

  return (
    <InviteJoinForm code={code} groupName={invite.name} profileName={profile.name} />
  );
}
