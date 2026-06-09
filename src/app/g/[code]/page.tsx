import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getGroupStandings } from "@/lib/groups";
import { BORINGBOT_ID } from "@/lib/standings";
import { Leaderboard } from "@/components/Leaderboard";
import { GroupAdmin } from "@/components/GroupAdmin";
import { LeaveGroup } from "@/components/LeaveGroup";
import { InviteLink } from "@/components/InviteLink";
import { LoadError } from "@/components/LoadError";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const userId = await getUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/g/${code}`)}`);

  let data;
  try {
    data = await getGroupStandings(code, userId);
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load this group"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }
  if (!data) notFound();

  // Only members may see a group's standings.
  if (!data.viewer.isMember) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 text-xl font-black text-stone-700 dark:text-stone-100">
          You&apos;re not in this group
        </h1>
        <p className="mt-2 text-sm font-medium text-stone-500 dark:text-stone-300">
          Ask an admin for the join code, then enter it on the join page.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/join"
            className="rounded-full glass px-6 py-3 font-bold text-pitch transition active:scale-95 dark:text-emerald-400"
          >
            Join a group
          </Link>
          <Link
            href="/groups"
            className="rounded-full glass px-6 py-3 font-bold text-grape transition active:scale-95 dark:text-violet-300"
          >
            My groups
          </Link>
        </div>
      </main>
    );
  }

  const { group, standings, viewer } = data;
  const members = standings.overall
    .filter((r) => r.userId !== BORINGBOT_ID)
    .map((r) => ({ userId: r.userId, displayName: r.displayName }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm font-bold text-stone-400">
        ← Home
      </Link>

      <header className="mt-3 mb-6 rounded-3xl glass p-6 text-center">
        <h1 className="text-3xl font-black text-grape dark:text-violet-300">
          {group.name}
        </h1>
        <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-300">
          Invite others with the code
        </p>
        <div className="mt-2 inline-block rounded-2xl glass px-6 py-2 text-2xl font-black tracking-[0.25em] text-flame">
          {group.code}
        </div>
        <div className="mt-3 flex justify-center">
          <InviteLink code={group.code} />
        </div>
        <p className="mt-3 text-xs text-stone-400">
          {group.memberCount}{" "}
          {group.memberCount === 1 ? "member" : "members"} ·{" "}
          {group.lateJoinPolicy === "carry_over"
            ? "late joiners keep earlier predictions"
            : "everyone starts even"}
        </p>
        <Link
          href="/predict"
          className="mt-4 inline-block rounded-full glass px-6 py-3 font-bold text-pitch transition active:scale-95 dark:text-emerald-400"
        >
          ⚽ Make your predictions
        </Link>
      </header>

      <Leaderboard data={standings} code={group.code} />

      {viewer.isAdmin && (
        <GroupAdmin
          code={group.code}
          name={group.name}
          members={members}
          creatorId={group.creatorId}
        />
      )}

      {userId !== group.creatorId && (
        <div className="mt-6">
          <LeaveGroup code={group.code} name={group.name} />
        </div>
      )}

      <p className="mt-8 text-center text-xs text-stone-400">
        Standings update as match results are confirmed.
      </p>
    </main>
  );
}
