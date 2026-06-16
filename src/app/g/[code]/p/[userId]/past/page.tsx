import { notFound, redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getViewerMembership } from "@/lib/groups";
import { getPlayerProfile } from "@/lib/player";
import { PlayerPredictions } from "@/components/PlayerPredictions";
import { LoadError } from "@/components/LoadError";
import { PageShell } from "@/components/PageShell";

export const dynamic = "force-dynamic";

export default async function PlayerPastPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string; userId: string }>;
  searchParams: Promise<{ hl?: string }>;
}) {
  const { code, userId } = await params;
  // Badge chips on the profile link here with the matches they were earned on,
  // so those cards can be highlighted and scrolled into view.
  const { hl } = await searchParams;
  const highlightIds = hl ? hl.split(",").filter(Boolean) : [];

  const viewerId = await getUserId();
  if (!viewerId) {
    redirect(
      `/login?next=${encodeURIComponent(`/g/${code}/p/${userId}/past`)}`,
    );
  }
  // Only members of the group may view a player's past results within it.
  const membership = await getViewerMembership(code, viewerId);
  if (!membership.isMember) redirect(`/g/${code}`);

  let profile;
  try {
    profile = await getPlayerProfile({ code, userId, viewerId });
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load these results"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }
  if (!profile) notFound();

  const { group, player } = profile;
  // Past matches are fully revealed for everyone, so the copy speaks of "their"
  // call for other players and "your" call on your own page.
  const who = player.isViewer
    ? { has: "you've", call: "your" }
    : { has: `${player.displayName} has`, call: "their" };

  return (
    <PageShell
      width="content"
      back={{ href: `/g/${group.code}/p/${userId}`, label: player.displayName }}
    >
      <h1 className="mb-1 gradient-text font-display pb-1 text-3xl leading-tight tracking-tight">
        Past results
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-300">
        Every match {who.has} predicted that&apos;s finished — {who.call} call
        beside the full-time score. Tap a card for the points math.
      </p>

      <PlayerPredictions
        profile={profile}
        view="past"
        highlightIds={highlightIds}
      />
    </PageShell>
  );
}
