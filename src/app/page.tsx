import Link from "next/link";
import { MatchCard, type MatchCardData } from "@/components/MatchCard";
import { Leaderboard } from "@/components/Leaderboard";
import { PredictionList } from "@/components/PredictionList";
import { FOCUS_RING } from "@/components/theme";
import { DEMO_LEADERBOARD } from "@/lib/mock";
import { getUserId } from "@/lib/identity";
import { getPredictionBoard } from "@/lib/predictions";
import { getUserGroups } from "@/lib/groups";
import { FIXTURES } from "@/data/fixtures";

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
  if (userId) {
    try {
      [board, groups] = await Promise.all([
        getPredictionBoard(userId),
        getUserGroups(userId),
      ]);
    } catch {
      // Home must never hard-fail on a data hiccup — fall back to the preview.
      board = null;
    }
  }
  const boardMatches = board?.matches.slice(0, 6) ?? [];
  const upcoming = board ? [] : upcomingFixtures();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 text-center">
        {/* Display face (Archivo Black) is inherently black-weight, so no
            font-black — that would only synthesise a faux bold on top. */}
        <h1 className="gradient-text font-display pb-1 text-4xl leading-tight tracking-tight sm:text-5xl">
          You think you know ball?
        </h1>
        <p className="mt-2 font-medium text-stone-500 dark:text-stone-300">
          Football, that is. Dubious until proven — predict every World Cup 2026
          match and beat your group.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <a
            href="/join?mode=create"
            className="rounded-full chrome px-6 py-3 font-bold text-pitch dark:text-emerald-400 transition active:scale-95"
          >
            Create a group
          </a>
          <a
            href="/join"
            className="rounded-full chrome px-6 py-3 font-bold text-grape transition active:scale-95 dark:text-violet-300"
          >
            Join a group
          </a>
        </div>
        <a
          href="/how-to-play"
          className="mt-3 inline-block text-sm font-bold text-grape hover:underline dark:text-violet-300"
        >
          New here? How to play →
        </a>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-lg font-black text-stone-700 dark:text-stone-100">
              {board ? "Next up — make your calls" : "Upcoming matches"}
            </h2>
            {board && (
              <Link
                href="/predict"
                className={`rounded-md text-sm font-bold text-grape underline-offset-2 hover:underline dark:text-violet-300 ${FOCUS_RING}`}
              >
                All matches →
              </Link>
            )}
          </div>

          {board ? (
            boardMatches.length === 0 ? (
              <div className="rounded-2xl glass p-6 text-center font-medium text-stone-500 dark:text-stone-300">
                <div className="mb-2 text-4xl">⚽</div>
                No upcoming matches to predict right now.
              </div>
            ) : (
              // The real steppers, saving the same predictions as /predict.
              <PredictionList
                matches={boardMatches}
                initial={board.predictions}
              />
            )
          ) : (
            <>
              {/* Signed out: predictions live behind a login. Say so up front. */}
              <Link
                href="/login?next=/"
                className={`mb-4 flex items-center justify-center gap-2 rounded-2xl glass px-4 py-3 text-sm font-bold text-pitch transition active:scale-[0.99] dark:text-emerald-400 ${FOCUS_RING}`}
              >
                🔓 Log in to make your predictions →
              </Link>
              {/* Below lg this section spans the full container, so tablets fit a
                  third card per row; at lg+ it shares the row with the leaderboard
                  column (~half width), where two columns is the readable maximum. */}
              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2">
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
              <h2 className="mb-4 text-center text-2xl font-black text-grape dark:text-violet-300">
                👥 Your groups
              </h2>
              {groups.length === 0 ? (
                <div className="text-center">
                  <div className="mb-2 text-4xl">📭</div>
                  <h3 className="text-lg font-black text-stone-700 dark:text-stone-100">
                    No groups yet
                  </h3>
                  <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-300">
                    Create one or join with a code — your picks count there
                    instantly.
                  </p>
                  <Link
                    href="/join"
                    className={`mt-4 inline-block rounded-full chrome px-6 py-3 font-bold text-pitch transition active:scale-95 dark:text-emerald-400 ${FOCUS_RING}`}
                  >
                    Create or join a group
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {groups.map((g) => (
                    <li key={g.code}>
                      <Link
                        href={`/g/${g.code}`}
                        className={`flex items-center justify-between gap-3 rounded-2xl glass px-4 py-3 font-bold text-stone-700 transition hover:scale-[1.01] active:scale-[0.99] dark:text-stone-100 ${FOCUS_RING}`}
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
    </main>
  );
}
