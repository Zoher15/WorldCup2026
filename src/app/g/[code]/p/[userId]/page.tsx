import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getPlayerProfile } from "@/lib/player";
import { PlayerPredictions } from "@/components/PlayerPredictions";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ code: string; userId: string }>;
}) {
  const { code, userId } = await params;
  const viewerId = await getUserId();
  const profile = await getPlayerProfile({ code, userId, viewerId });
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

      <header className="mt-3 mb-6 rounded-3xl bg-white/85 p-6 text-center shadow-lg ring-1 ring-black/5 dark:bg-stone-800/85 dark:ring-white/10">
        <h1 className="text-3xl font-black text-grape dark:text-violet-300">
          {player.displayName}
          {player.isViewer && (
            <span className="ml-2 align-middle text-xs font-bold text-stone-400">
              (you)
            </span>
          )}
        </h1>
        <p className="mt-2 text-sm font-medium text-stone-500 dark:text-stone-300">
          {summary.points} pts · predicted {summary.predicted} of {summary.total}{" "}
          matches
        </p>
        {!player.isViewer && (
          <p className="mt-2 text-xs text-stone-400">
            Picks for matches that haven&apos;t kicked off stay hidden.
          </p>
        )}
      </header>

      <PlayerPredictions profile={profile} />
    </main>
  );
}
