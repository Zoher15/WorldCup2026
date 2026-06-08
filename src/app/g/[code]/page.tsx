import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupStandings } from "@/lib/groups";
import { Leaderboard } from "@/components/Leaderboard";
import { LoadError } from "@/components/LoadError";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  let data;
  try {
    data = await getGroupStandings(code);
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load this group"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }
  if (!data) notFound();
  const { group, standings } = data;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm font-bold text-stone-400">
        ← Home
      </Link>

      <header className="mt-3 mb-6 rounded-3xl glass p-6 text-center">
        <h1 className="text-3xl font-black text-grape dark:text-violet-300">{group.name}</h1>
        <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-300">
          Invite others with the code
        </p>
        <div className="mt-2 inline-block rounded-2xl bg-cream px-6 py-2 text-2xl font-black tracking-[0.25em] text-flame dark:bg-stone-700">
          {group.code}
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
          className="mt-4 inline-block rounded-full bg-pitch px-6 py-3 font-bold text-white shadow transition active:scale-95"
        >
          ⚽ Make your predictions
        </Link>
      </header>

      <Leaderboard data={standings} code={group.code} />

      <p className="mt-8 text-center text-xs text-stone-400">
        Standings update as match results are confirmed.
      </p>
    </main>
  );
}
