import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { listTeamGroups } from "@/lib/team";
import { Flag } from "@/components/Flag";
import { LoadError } from "@/components/LoadError";
import { PageShell } from "@/components/PageShell";
import { FOCUS_RING } from "@/components/theme";

export const dynamic = "force-dynamic";

export default async function TeamsIndexPage() {
  const viewerId = await getUserId();
  if (!viewerId) redirect("/login?next=/t");

  let groups;
  try {
    groups = await listTeamGroups();
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load the teams"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }

  return (
    <PageShell width="content" back={{ href: "/", label: "Home" }}>
      <h1 className="mb-1 gradient-text font-display pb-1 text-3xl leading-tight tracking-tight">
        Teams
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-300">
        Pick a country to see its games — past results and upcoming fixtures.
      </p>

      {groups.length === 0 ? (
        <p className="rounded-2xl glass px-4 py-3 text-sm font-medium text-stone-400">
          No teams yet — they&apos;ll appear once the fixtures are loaded.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-stone-400">
                Group {g.label}
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {g.teams.map((t) => (
                  <li key={t.code}>
                    <Link
                      href={`/t/${t.code}`}
                      prefetch={false}
                      className={`flex items-center gap-3 rounded-2xl glass px-4 py-2.5 transition hover:scale-[1.01] active:scale-[0.99] ${FOCUS_RING}`}
                    >
                      <Flag code={t.code} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-bold text-stone-100">
                        {t.name}
                      </span>
                      <span className="text-violet-300">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
