import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getViewerMembership } from "@/lib/groups";
import { derivePlayerBadges, getPlayerProfile } from "@/lib/player";
import { PlayerPredictions } from "@/components/PlayerPredictions";
import { ShareAchievements } from "@/components/ShareAchievements";
import { LoadError } from "@/components/LoadError";
import { PageShell } from "@/components/PageShell";
import { FOCUS_RING } from "@/components/theme";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ code: string; userId: string }>;
}) {
  const { code, userId } = await params;

  const viewerId = await getUserId();
  if (!viewerId) {
    redirect(`/login?next=${encodeURIComponent(`/g/${code}/p/${userId}`)}`);
  }
  // Only members of the group may view a player's profile within it.
  const membership = await getViewerMembership(code, viewerId);
  if (!membership.isMember) redirect(`/g/${code}`);

  let profile;
  try {
    profile = await getPlayerProfile({ code, userId, viewerId });
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load this profile"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }
  if (!profile) notFound();

  const { group, player, summary } = profile;
  const badges = derivePlayerBadges(profile.rows);

  return (
    <PageShell width="content" back={{ href: `/g/${group.code}`, label: group.name }}>
      <header className="mb-6 rounded-3xl glass p-6 text-center">
        <h1 className="text-3xl font-black text-violet-300">
          {player.displayName}
          {player.isViewer && (
            <span className="ml-2 align-middle text-xs font-bold text-stone-400">
              (you)
            </span>
          )}
        </h1>
        {player.realName && (
          <p className="mt-1 text-sm font-semibold text-stone-400">
            {player.realName}
          </p>
        )}
        {player.email && (
          <p className="mt-0.5 text-xs font-medium text-stone-500">
            <a
              href={`mailto:${player.email}`}
              className={`rounded-md underline-offset-2 hover:underline ${FOCUS_RING}`}
            >
              {player.email}
            </a>
          </p>
        )}
        <p className="mt-2 text-sm font-medium text-stone-300">
          {summary.points} pts · predicted {summary.predicted} of {summary.total}{" "}
          matches
        </p>
        {/* Badge chips, derived from the rows already loaded. Chips below their
            threshold simply don't render; the predicted count fills the row.
            Earned chips link to the matches behind them on the past-results
            page (highlighted and scrolled into view). */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {badges.streak >= 2 && (
            <Link
              href={`/g/${group.code}/p/${userId}/past?hl=${badges.streakMatchIds.join(",")}#m-${badges.streakMatchIds[0]}`}
              className={`rounded-full chrome px-3 py-1 text-xs font-bold text-flame transition active:scale-95 ${FOCUS_RING}`}
            >
              🔥 {badges.streak} in a row →
            </Link>
          )}
          {badges.exact >= 1 && (
            <Link
              href={`/g/${group.code}/p/${userId}/past?hl=${badges.exactMatchIds.join(",")}#m-${badges.exactMatchIds[0]}`}
              className={`rounded-full chrome px-3 py-1 text-xs font-bold text-sunburst transition active:scale-95 ${FOCUS_RING}`}
            >
              🎯 {badges.exact} exact →
            </Link>
          )}
          <span className="rounded-full chrome px-3 py-1 text-xs font-bold text-stone-300">
            🧮 {summary.predicted} predicted
          </span>
        </div>
        {player.isBot ? (
          <p className="mt-2 text-xs text-stone-400">
            The baseline bot — predicts 0–0 in every match. Beat it!
          </p>
        ) : !player.isViewer ? (
          <p className="mt-2 text-xs text-stone-400">
            Picks for matches that haven&apos;t kicked off stay hidden.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link
            href={`/g/${group.code}/p/${userId}/past`}
            className={`rounded-md text-sm font-bold text-violet-300 underline-offset-2 hover:underline ${FOCUS_RING}`}
          >
            Past results →
          </Link>
          {!player.isBot && (
            <Link
              href={`/p/${userId}`}
              prefetch={false}
              className={`rounded-md text-sm font-bold text-violet-300 underline-offset-2 hover:underline ${FOCUS_RING}`}
            >
              {player.isViewer ? "You across your groups →" : "Across your groups →"}
            </Link>
          )}
          <ShareAchievements
            code={group.code}
            userId={userId}
            displayName={player.displayName}
            groupName={group.name}
            points={summary.points}
            streak={badges.streak}
            exact={badges.exact}
          />
        </div>
      </header>

      <PlayerPredictions profile={profile} />
    </PageShell>
  );
}
