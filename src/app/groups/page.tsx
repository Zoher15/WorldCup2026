import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getUserGroups } from "@/lib/groups";
import { EmptyState } from "@/components/EmptyState";
import { FOCUS_RING } from "@/components/theme";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/groups");

  const groups = await getUserGroups(userId);

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Link
        href="/"
        className={`rounded-md text-sm font-bold text-stone-400 ${FOCUS_RING}`}
      >
        ← Home
      </Link>
      <h1 className="mt-3 mb-1 gradient-text font-display pb-1 text-3xl leading-tight">
        Your groups
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
        Every group you&apos;re in — tap one for its leaderboard.
      </p>

      {groups.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No groups yet"
          hint="Create one or join with a friend's code — your picks count there instantly."
          href="/join"
          cta="Create or join a group"
        />
      ) : (
        <>
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.code}>
                <Link
                  href={`/g/${g.code}`}
                  className={`flex items-center justify-between gap-3 rounded-2xl glass p-4 transition hover:scale-[1.01] active:scale-[0.99] ${FOCUS_RING}`}
                >
                  <span className="min-w-0">
                    <span
                      title={g.name}
                      className="block truncate font-black text-stone-800 dark:text-stone-100"
                    >
                      {g.name}
                    </span>
                    <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      {g.memberCount} {g.memberCount === 1 ? "member" : "members"} ·
                      code {g.code}
                    </span>
                  </span>
                  <span className="text-grape dark:text-violet-300">→</span>
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/join"
            className={`mt-5 inline-block rounded-full glass px-6 py-3 font-bold text-pitch transition active:scale-95 dark:text-emerald-400 ${FOCUS_RING}`}
          >
            + New group
          </Link>
        </>
      )}
    </main>
  );
}
