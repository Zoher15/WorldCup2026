import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getViewerMembership } from "@/lib/groups";
import { getMatchLeaderboard } from "@/lib/match-leaderboard";
import { teamLabel } from "@/lib/fifa";
import { MatchLeaderboard } from "@/components/MatchLeaderboard";
import { ShareMatch } from "@/components/ShareMatch";
import { LoadError } from "@/components/LoadError";
import { FOCUS_RING } from "@/components/theme";

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
        className={`rounded-md text-sm font-bold text-stone-400 ${FOCUS_RING}`}
      >
        ← {board.group.name}
      </Link>

      <div className="mt-3 mb-6 flex items-start justify-between gap-3">
        <h1 className="gradient-text font-display pb-1 text-3xl leading-tight">
          Match predictions
        </h1>
        <div className="shrink-0 pt-1">
          <ShareMatch
            code={board.group.code}
            matchId={matchId}
            fixture={`${teamLabel(board.match.homeCode, board.match.homeLabel)} v ${teamLabel(board.match.awayCode, board.match.awayLabel)}`}
            groupName={board.group.name}
          />
        </div>
      </div>

      <MatchLeaderboard board={board} />

      <p className="mt-8 text-center text-xs text-stone-400">
        Picks unlock at kickoff · points are confirmed once the result is final.
      </p>
    </main>
  );
}
