import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getCrossGroupPlayer } from "@/lib/groups";
import { LoadError } from "@/components/LoadError";

export const dynamic = "force-dynamic";

export default async function PlayerHubPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const viewerId = await getUserId();
  if (!viewerId) {
    redirect(`/login?next=${encodeURIComponent(`/p/${userId}`)}`);
  }

  let data;
  try {
    data = await getCrossGroupPlayer({ viewerId, targetUserId: userId });
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load this player"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }

  const { player, groups } = data;
  const title = player.isViewer
    ? "You"
    : player.displayName || "This player";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/groups" className="text-sm font-bold text-stone-400">
        ← My groups
      </Link>

      <header className="mt-3 mb-6 rounded-3xl glass p-6 text-center">
        <h1 className="text-3xl font-black text-violet-300">
          {title}
          {player.isViewer && (
            <span className="ml-2 align-middle text-xs font-bold text-stone-400">
              (you)
            </span>
          )}
        </h1>
        <p className="mt-2 text-sm font-medium text-stone-300">
          {groups.length > 0
            ? `Across ${groups.length} ${
                groups.length === 1 ? "group" : "groups"
              } you share`
            : "No shared groups"}
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="rounded-2xl glass p-6 text-center font-medium text-stone-300">
          {player.isViewer
            ? "Join a group to start tracking your predictions."
            : "You aren't in any of the same groups as this player yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.code}>
              <Link
                href={`/g/${g.code}/p/${userId}`}
                prefetch={false}
                className="flex items-center gap-3 rounded-2xl glass px-4 py-3.5 transition active:scale-[0.99]"
              >
                <span className="w-10 shrink-0 text-center text-lg font-black text-stone-400 tabular-nums">
                  #{g.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-stone-100">
                    {g.name}
                  </span>
                  <span className="block truncate text-xs font-medium text-stone-400">
                    {g.displayName} · {g.rank} of {g.total}
                  </span>
                </span>
                <span className="shrink-0 font-black tabular-nums text-emerald-400">
                  {g.live ? "~" : ""}
                  {g.points} pt{g.points === 1 ? "" : "s"}
                </span>
                <span className="shrink-0 text-violet-300">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
