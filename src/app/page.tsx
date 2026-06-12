import { MatchCard, type MatchCardData } from "@/components/MatchCard";
import { Leaderboard } from "@/components/Leaderboard";
import { DEMO_LEADERBOARD } from "@/lib/mock";
import { FIXTURES } from "@/data/fixtures";

// The next handful of fixtures by kickoff, shown as upcoming matches to predict.
const UPCOMING: MatchCardData[] = FIXTURES.slice(0, 6).map((f) => ({
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

export default function Home() {
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
          <h2 className="mb-3 px-1 text-lg font-black text-stone-700 dark:text-stone-100">
            Upcoming matches
          </h2>
          {/* Below lg this section spans the full container, so tablets fit a
              third card per row; at lg+ it shares the row with the leaderboard
              column (~half width), where two columns is the readable maximum. */}
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2">
            {/* The next kickoff is the hero: full-width, vivid, gradient ring. */}
            {UPCOMING.map((m, i) =>
              i === 0 ? (
                <div key={i} className="sm:col-span-2 md:col-span-3 lg:col-span-2">
                  <MatchCard data={m} revealOnHover hero />
                </div>
              ) : (
                <MatchCard key={i} data={m} revealOnHover />
              ),
            )}
          </div>
        </section>

        <section>
          <Leaderboard data={DEMO_LEADERBOARD} />
        </section>
      </div>

      <p className="mt-10 text-center text-xs text-stone-400">
        Visual preview with sample data — scoring, schema and live-polling engine
        are wired up separately.
      </p>
    </main>
  );
}
