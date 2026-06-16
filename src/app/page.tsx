import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { MatchCard, type MatchCardData } from "@/components/MatchCard";
import { Leaderboard } from "@/components/Leaderboard";
import { PredictionList } from "@/components/PredictionList";
import { PageShell } from "@/components/PageShell";
import { FOCUS_RING } from "@/components/theme";
import { DEMO_LEADERBOARD } from "@/lib/mock";
import { getUserId } from "@/lib/identity";
import { getPredictionBoard } from "@/lib/predictions";
import { getUserGroups, getViewerStanding, type ViewerStanding } from "@/lib/groups";
import { FIXTURES } from "@/data/fixtures";

/** Rank-first mobile strip: the viewer's best standing across their groups,
 *  leading the dashboard so rank isn't buried below the six prediction cards.
 *  Mobile-only (`lg:hidden`) — at lg+ the two-column rail surfaces groups
 *  directly. Composes the precomputed standing; no heavy component duplicated. */
function StandingStrip({ standing }: { standing: ViewerStanding }) {
  return (
    <Link
      href={`/g/${standing.code}`}
      className={`mb-6 flex items-center gap-4 rounded-2xl glass px-4 py-3 transition active:scale-[0.99] lg:hidden ${FOCUS_RING}`}
    >
      <span className="flex flex-col items-center leading-none">
        <span className="font-display text-3xl text-emerald-400 tabular-nums">
          #{standing.rank}
        </span>
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">
          of {standing.total}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-stone-100">
          {standing.name}
          {standing.live && (
            <span className="ml-1.5 align-middle text-xs font-bold text-flame">
              ● live
            </span>
          )}
        </span>
        {standing.delta && (
          <span className="block truncate text-xs font-medium text-stone-400">
            {standing.delta}
          </span>
        )}
      </span>
      <span className="shrink-0 font-display text-lg text-violet-300 tabular-nums">
        {standing.points}
        <span className="ml-0.5 text-xs font-bold text-stone-400">pts</span>
      </span>
    </Link>
  );
}

// The schedule (and a signed-in visitor's board) must track the clock, not the
// build — otherwise yesterday's games linger here.
export const dynamic = "force-dynamic";

/** The next handful of fixtures by kickoff — the signed-out preview. */
function upcomingFixtures(): MatchCardData[] {
  const now = Date.now();
  return FIXTURES.filter((f) => Date.parse(f.kickoffAt) > now)
    .slice(0, 6)
    .map((f) => ({
      homeCode: f.homeCode,
      awayCode: f.awayCode,
      homeLabel: f.homeLabel,
      awayLabel: f.awayLabel,
      kickoffAt: f.kickoffAt,
      stage: f.stage,
      groupLabel: f.groupLabel,
      venue: f.venue,
      state: "upcoming",
    }));
}

export default async function Home() {
  const userId = await getUserId();

  // Signed in: the home page is a live prediction surface — the next matches
  // with real steppers, synced to (and saving) the same predictions as
  // /predict. Signed out: a preview of the schedule plus a login nudge.
  let board: Awaited<ReturnType<typeof getPredictionBoard>> | null = null;
  let groups: Awaited<ReturnType<typeof getUserGroups>> = [];
  let standing: ViewerStanding | null = null;
  if (userId) {
    try {
      [board, groups, standing] = await Promise.all([
        getPredictionBoard(userId),
        getUserGroups(userId),
        // Rank-first mobile strip; never let it sink the page.
        getViewerStanding(userId).catch(() => null),
      ]);
    } catch {
      // Home must never hard-fail on a data hiccup — fall back to the preview.
      board = null;
    }
  }
  const boardMatches = board?.matches.slice(0, 6) ?? [];
  const upcoming = board ? [] : upcomingFixtures();
  // The embedded predictor renders a fixed save bar; reserve clearance for it
  // (plus the mobile tab bar) only when it's actually shown.
  const showsSaveBar = board != null && boardMatches.length > 0;

  return (
    <PageShell
      width="wide"
      bottomInset={showsSaveBar ? "nav-savebar" : "nav"}
    >
      <header className="mb-8 text-center">
        {/* Display face (Archivo Black) is inherently black-weight, so no
            font-black — that would only synthesise a faux bold on top. */}
        <h1 className="gradient-text font-display pb-1 text-4xl leading-tight tracking-tight sm:text-5xl">
          You think you know ball?
        </h1>
        <p className="mt-2 font-medium text-stone-300">
          Football, that is. Dubious until proven — predict every World Cup 2026
          match and beat your group.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <a
            href="/join?mode=create"
            className="rounded-full chrome px-6 py-3 font-bold text-emerald-400 transition active:scale-95"
          >
            Start a group
          </a>
          <a
            href="/join"
            className="rounded-full chrome px-6 py-3 font-bold text-violet-300 transition active:scale-95"
          >
            Got a code? Join
          </a>
        </div>
        <a
          href="/how-to-play"
          className="mt-3 inline-block text-sm font-bold text-violet-300 hover:underline"
        >
          New here? How to play →
        </a>
      </header>

      {/* Rank-first on mobile: the viewer's best standing leads, above the
          predictor and groups (hidden at lg+, where the rail shows groups). */}
      {standing && <StandingStrip standing={standing} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-lg font-black text-stone-100">
              {board ? "Next up — make your calls" : "Upcoming matches"}
            </h2>
            {board && (
              <Link
                href="/predict"
                className={`rounded-md text-sm font-bold text-violet-300 underline-offset-2 hover:underline ${FOCUS_RING}`}
              >
                All matches →
              </Link>
            )}
          </div>

          {board ? (
            boardMatches.length === 0 ? (
              <div className="rounded-2xl glass p-6 text-center font-medium text-stone-300">
                <div className="float-bob mb-2 text-4xl">⚽</div>
                No upcoming matches to predict right now.
              </div>
            ) : (
              // The real steppers, saving the same predictions as /predict.
              // Embedded: single-column (cards keep the predict page's width
              // instead of being squeezed by the groups panel) and no bottom
              // padding of its own — the page reserves save-bar clearance below
              // the groups section instead.
              <PredictionList
                matches={boardMatches}
                initial={board.predictions}
                embedded
              />
            )
          ) : (
            <>
              {/* Signed out: predictions live behind a login. Say so up front. */}
              <Link
                href="/login?next=/"
                className={`mb-4 flex items-center justify-center gap-2 rounded-2xl glass px-4 py-3 text-sm font-bold text-emerald-400 transition active:scale-[0.99] ${FOCUS_RING}`}
              >
                🔓 Log in to make your predictions →
              </Link>
              {/* Below lg this section spans the full container, so tablets fit a
                  third card per row; at lg+ it shares the row with the leaderboard
                  column (~half width), where two columns is the readable maximum. */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2">
                {/* The next kickoff is the hero: full-width, vivid, gradient ring. */}
                {upcoming.map((m, i) =>
                  i === 0 ? (
                    <div key={i} className="sm:col-span-2 md:col-span-3 lg:col-span-2">
                      <MatchCard data={m} revealOnHover hero />
                    </div>
                  ) : (
                    <MatchCard key={i} data={m} revealOnHover />
                  ),
                )}
              </div>
            </>
          )}
        </section>

        <section>
          {board ? (
            <div className="rounded-3xl glass p-5">
              <h2 className="mb-4 text-center text-2xl font-black">
                👥 <span className="gradient-text">Your groups</span>
              </h2>
              {groups.length === 0 ? (
                <EmptyState
                  framed={false}
                  heading="h3"
                  icon="📭"
                  title="No groups yet"
                  hint="Create one or join with a code — your picks count there instantly."
                  href="/join"
                  cta="Create or join a group"
                />
              ) : (
                <ul className="space-y-2">
                  {groups.map((g, i) => (
                    <li key={g.code}>
                      <Link
                        href={`/g/${g.code}`}
                        style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
                        className={`rise-in flex items-center justify-between gap-3 rounded-2xl glass px-4 py-3 font-bold text-stone-100 transition hover:scale-[1.01] active:scale-[0.99] ${FOCUS_RING}`}
                      >
                        <span className="truncate">{g.name}</span>
                        <span className="shrink-0 text-xs font-bold text-stone-400">
                          {g.memberCount} member{g.memberCount === 1 ? "" : "s"} →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <Leaderboard data={DEMO_LEADERBOARD} />
          )}
        </section>
      </div>

      {!board && (
        <p className="mt-10 text-center text-xs text-stone-400">
          Leaderboard shown with sample data — log in to see the real thing.
        </p>
      )}
    </PageShell>
  );
}
