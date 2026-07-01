import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getTeamSchedule } from "@/lib/team";
import { Flag } from "@/components/Flag";
import { TeamSchedule } from "@/components/TeamSchedule";
import { LoadError } from "@/components/LoadError";
import { PageShell } from "@/components/PageShell";
import { FOCUS_RING } from "@/components/theme";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const viewerId = await getUserId();
  if (!viewerId) {
    redirect(`/login?next=${encodeURIComponent(`/t/${code}`)}`);
  }

  let schedule;
  try {
    schedule = await getTeamSchedule(code);
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load this team"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }
  if (!schedule) notFound();

  const { team, record } = schedule;

  return (
    <PageShell width="content" back={{ href: "/t", label: "All teams" }}>
      <header className="mb-6 rounded-3xl glass p-6 text-center">
        <div className="flex justify-center">
          <Flag code={team.code} size="lg" />
        </div>
        <h1 className="mt-3 text-3xl font-black">
          <span className="gradient-text">{team.name}</span>
        </h1>
        {team.groupLabel && (
          <p className="mt-1 text-sm font-semibold text-stone-400">
            Group {team.groupLabel}
          </p>
        )}
        {record.played > 0 ? (
          <p className="mt-2 text-sm font-medium text-stone-300">
            Played {record.played} · {record.wins}W {record.draws}D {record.losses}L
            {" · "}
            <span className="tabular-nums">
              {record.goalsFor}–{record.goalsAgainst}
            </span>{" "}
            goals
          </p>
        ) : (
          <p className="mt-2 text-sm font-medium text-stone-300">
            No games played yet — their fixtures are below.
          </p>
        )}
        <p className="mt-3 text-xs text-stone-400">
          Tap a match for everyone&apos;s predictions.
        </p>
      </header>

      <TeamSchedule rows={schedule.rows} />

      <div className="mt-6 text-center">
        <Link
          href="/t"
          className={`rounded-md text-sm font-bold text-violet-300 underline-offset-2 hover:underline ${FOCUS_RING}`}
        >
          Browse all teams →
        </Link>
      </div>
    </PageShell>
  );
}
