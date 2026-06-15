import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getCrossGroupMatchBoards } from "@/lib/match-leaderboard";
import { CrossGroupMatchHub } from "@/components/CrossGroupMatchHub";
import { LoadError } from "@/components/LoadError";

export const dynamic = "force-dynamic";

export default async function MatchHubPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  const viewerId = await getUserId();
  if (!viewerId) {
    redirect(`/login?next=${encodeURIComponent(`/m/${matchId}`)}`);
  }

  let data;
  try {
    data = await getCrossGroupMatchBoards({ matchId, viewerId });
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load this match"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }
  // Null means the match id doesn't exist in any of the viewer's groups.
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/predict" className="text-sm font-bold text-stone-400">
        ← My predictions
      </Link>

      <h1 className="mt-3 mb-6 gradient-text pb-1 text-3xl font-black leading-tight">
        Match predictions
      </h1>

      {data.match && data.groups.length > 0 ? (
        <>
          <CrossGroupMatchHub
            matchId={matchId}
            match={data.match}
            boards={data.groups}
          />
          <p className="mt-8 text-center text-xs text-stone-400">
            Picks unlock at kickoff · points are confirmed once the result is
            final.
          </p>
        </>
      ) : (
        <div className="rounded-3xl glass p-8 text-center">
          <p className="font-medium text-stone-500 dark:text-stone-300">
            You&apos;re not in any groups yet — join one to compare everyone&apos;s
            picks for this match.
          </p>
          <Link
            href="/join"
            className="mt-4 inline-block rounded-full glass px-6 py-3 font-bold text-pitch dark:text-emerald-400 transition active:scale-95"
          >
            Create or join a group
          </Link>
        </div>
      )}
    </main>
  );
}
