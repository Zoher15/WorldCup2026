import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getUserGroups } from "@/lib/groups";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/groups");

  const groups = await getUserGroups(userId);

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-4 bg-gradient-to-r from-flame to-grape bg-clip-text pb-1 text-3xl font-black leading-tight text-transparent">
        Your groups
      </h1>

      {groups.length === 0 ? (
        <p className="rounded-2xl glass p-6 text-center text-sm font-medium text-stone-500 dark:text-stone-300">
          You&apos;re not in any groups yet.{" "}
          <Link href="/join" className="font-bold text-pitch dark:text-emerald-400">
            Create or join one →
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.code}>
              <Link
                href={`/g/${g.code}`}
                className="flex items-center justify-between gap-3 rounded-2xl glass p-4 transition active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-black text-stone-800 dark:text-stone-100">
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
      )}

      <Link
        href="/join"
        className="mt-5 inline-block rounded-full glass px-6 py-3 font-bold text-pitch transition active:scale-95 dark:text-emerald-400"
      >
        + New group
      </Link>
    </main>
  );
}
