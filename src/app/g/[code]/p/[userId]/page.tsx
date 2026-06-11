import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getViewerMembership } from "@/lib/groups";
import { getPlayerProfile } from "@/lib/player";
import { PlayerPredictions } from "@/components/PlayerPredictions";
import { LoadError } from "@/components/LoadError";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ code: string; userId: string }>;
}) {
  const { code, userId } = await params;

  const viewerId = await getUserId();
  if (!viewerId) {
    redirect(`/login?next=${encodeURIComponent(`/g/${code}/p/${userId}`)}`);
  }
  // Only members of the group may view a player's profile within it.
  const membership = await getViewerMembership(code, viewerId);
  if (!membership.isMember) redirect(`/g/${code}`);

  let profile;
  try {
    profile = await getPlayerProfile({ code, userId, viewerId });
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load this profile"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }
  if (!profile) notFound();

  const { group, player, summary } = profile;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/g/${group.code}`}
        className="text-sm font-bold text-stone-400"
      >
        ← {group.name}
      </Link>

      <header className="mt-3 mb-6 rounded-3xl glass p-6 text-center">
        <h1 className="text-3xl font-black text-grape dark:text-violet-300">
          {player.displayName}
          {player.isViewer && (
            <span className="ml-2 align-middle text-xs font-bold text-stone-400">
              (you)
            </span>
          )}
        </h1>
        {player.realName && (
          <p className="mt-1 text-sm font-semibold text-stone-500 dark:text-stone-400">
            {player.realName}
          </p>
        )}
        <p className="mt-2 text-sm font-medium text-stone-500 dark:text-stone-300">
          {summary.points} pts · predicted {summary.predicted} of {summary.total}{" "}
          matches
        </p>
        {player.isBot ? (
          <p className="mt-2 text-xs text-stone-400">
            The baseline bot — predicts 0–0 in every match. Beat it!
          </p>
        ) : !player.isViewer ? (
          <p className="mt-2 text-xs text-stone-400">
            Picks for matches that haven&apos;t kicked off stay hidden.
          </p>
        ) : null}
      </header>

      <PlayerPredictions profile={profile} />
    </main>
  );
}
