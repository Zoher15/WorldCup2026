import { MatchCard, type MatchCardData } from "@/components/MatchCard";
import { Leaderboard } from "@/components/Leaderboard";
import { DEMO_LEADERBOARD } from "@/lib/mock";
import { FIXTURES } from "@/data/fixtures";

// The next handful of fixtures by kickoff, shown as upcoming matches to predict.
const UPCOMING: MatchCardData[] = FIXTURES.slice(0, 6).map((f) => ({
  homeCode: f.homeCode,
  awayCode: f.awayCode,
  homeLabel: f.homeLabel ?? undefined,
  awayLabel: f.awayLabel ?? undefined,
  kickoffAt: f.kickoffAt,
  venue: f.venue,
  status: "scheduled",
}));

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-pitch px-4 py-1.5 text-sm font-bold text-white shadow">
          ⚽ World Cup 2026
        </div>
        <h1 className="mt-3 bg-gradient-to-r from-flame via-grape to-ocean bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
          Predict. Compete. Celebrate.
        </h1>
        <p className="mt-2 font-medium text-stone-500">
          Call the score, pick the winner, climb the leaderboard with the family.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <h2 className="mb-3 px-1 text-lg font-black text-stone-700">
            Upcoming matches
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {UPCOMING.map((m, i) => (
              <MatchCard key={i} data={m} />
            ))}
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
