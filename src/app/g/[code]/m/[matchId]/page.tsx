import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getViewerMembership } from "@/lib/groups";
import { getMatchLeaderboard } from "@/lib/match-leaderboard";
import { MatchLeaderboard } from "@/components/MatchLeaderboard";
import { LoadError } from "@/components/LoadError";

export const dynamic = "force-dynamic";

export default async function MatchBoardPage({
  params,
}: {
  params: Promise<{ code: string; matchId: string }>;
}) {
  const { code, matchId } = await params;

  const viewerId = await getUserId();
  if (!viewerId) {
    redirect(`/login?next=${encodeURIComponent(`/g/${code}/m/${matchId}`)}`);
  }
  // Only members of the group may see everyone's picks within it.
  const membership = await getViewerMembership(code, viewerId);
  if (!membership.isMember) redirect(`/g/${code}`);

  let board;
  try {
    board = await getMatchLeaderboard({ code, matchId, viewerId });
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load this match"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }
  if (!board) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/g/${board.group.code}`}
        className="text-sm font-bold text-stone-400"
      >
        ← {board.group.name}
      </Link>

      <h1 className="mt-3 mb-6 gradient-text pb-1 text-3xl font-black leading-tight">
        Match predictions
      </h1>

      <MatchLeaderboard board={board} />

      <p className="mt-8 text-center text-xs text-stone-400">
        Picks unlock at kickoff · points are confirmed once the result is final.
      </p>
    </main>
  );
}
