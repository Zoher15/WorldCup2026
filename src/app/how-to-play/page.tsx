import Link from "next/link";
import { HowToPlayDemo } from "@/components/HowToPlayDemo";
import { ADVANCE_BONUS, MAX_MATCH_POINTS } from "@/lib/scoring";

export const metadata = {
  title: "How to play · World Cup 2026 Predictions",
};

function Step({
  n,
  emoji,
  title,
  children,
}: {
  n: number;
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl glass p-5 text-center">
      <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-grape text-lg font-black text-white">
        {n}
      </div>
      <div className="text-3xl">{emoji}</div>
      <h3 className="mt-1 font-black text-stone-700 dark:text-stone-100">{title}</h3>
      <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-300">
        {children}
      </p>
    </div>
  );
}

export default function HowToPlayPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm font-bold text-stone-400">
        ← Home
      </Link>

      <header className="mt-3 mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm font-bold text-pitch dark:text-emerald-400">
          ⚽ How to play
        </div>
        <h1 className="mt-3 bg-gradient-to-r from-flame via-grape to-ocean bg-clip-text pb-1 text-4xl font-black leading-tight tracking-tight text-transparent">
          Predict the scores. Beat your group.
        </h1>
        <p className="mt-2 font-medium text-stone-500 dark:text-stone-300">
          Call the scoreline for each match. The closer you are, the more points
          you bank. Highest total wins.
        </p>
      </header>

      {/* 3 steps */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Step n={1} emoji="👋" title="Join your group">
          Tap your family&apos;s invite link and pick a nickname.
        </Step>
        <Step n={2} emoji="🔮" title="Predict the score">
          Enter a scoreline for each match before it kicks off.
        </Step>
        <Step n={3} emoji="🏆" title="Climb the board">
          Points land automatically as results come in.
        </Step>
      </div>

      {/* Scoring */}
      <section className="mb-10">
        <h2 className="mb-3 text-center text-xl font-black text-grape dark:text-violet-300">
          How points work
        </h2>
        <div className="rounded-3xl glass p-6 text-center">
          <p className="text-sm font-medium text-stone-500 dark:text-stone-300">
            Every match is worth up to{" "}
            <strong className="text-stone-700 dark:text-stone-100">
              {MAX_MATCH_POINTS} points
            </strong>
            , split two ways:
          </p>
          <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <div className="flex-1 rounded-2xl glass p-4">
              <div className="text-2xl font-black text-flame">up to 5</div>
              <div className="text-sm font-bold text-stone-700 dark:text-stone-100">
                Outcome
              </div>
              <p className="mt-1 text-xs font-medium text-stone-500 dark:text-stone-300">
                Right winner (or right draw) = 5. One step off = 2. Wrong = 0.
              </p>
            </div>
            <div className="flex-1 rounded-2xl glass p-4">
              <div className="text-2xl font-black text-ocean dark:text-sky-400">up to 5</div>
              <div className="text-sm font-bold text-stone-700 dark:text-stone-100">
                Closeness
              </div>
              <p className="mt-1 text-xs font-medium text-stone-500 dark:text-stone-300">
                Lose one point for each goal you&apos;re off the exact score.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive walkthrough */}
      <section className="mb-10">
        <h2 className="mb-1 text-center text-xl font-black text-grape dark:text-violet-300">
          Try it yourself
        </h2>
        <p className="mx-auto mb-4 max-w-md text-center text-sm font-medium text-stone-500 dark:text-stone-300">
          Call the score for this match, lock it in, and see how you&apos;d stack
          up against the family.
        </p>
        <HowToPlayDemo />
      </section>

      {/* Knockouts */}
      <section className="mb-10 rounded-3xl glass p-6 text-center">
        <div className="text-2xl">🥊</div>
        <h2 className="mt-1 text-lg font-black text-grape dark:text-violet-300">
          Knockout bonus
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm font-medium text-stone-600 dark:text-stone-200">
          From the Round of 32 on, also pick who goes through. Get it right and
          it&apos;s{" "}
          <strong className="text-grape dark:text-violet-300">
            +{ADVANCE_BONUS} bonus points
          </strong>{" "}
          — even if it took extra time or penalties.
        </p>
      </section>

      {/* Three boards */}
      <section className="mb-10">
        <h2 className="mb-3 text-center text-xl font-black text-grape dark:text-violet-300">
          Three ways to win
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl glass p-4 text-center">
            <div className="text-2xl">🏆</div>
            <div className="font-black text-stone-700 dark:text-stone-100">Overall</div>
            <p className="text-xs font-medium text-stone-500 dark:text-stone-300">
              Your total points — the main prize.
            </p>
          </div>
          <div className="rounded-2xl glass p-4 text-center">
            <div className="text-2xl">🎯</div>
            <div className="font-black text-stone-700 dark:text-stone-100">
              Win predictor
            </div>
            <p className="text-xs font-medium text-stone-500 dark:text-stone-300">
              Best at calling the right result.
            </p>
          </div>
          <div className="rounded-2xl glass p-4 text-center">
            <div className="text-2xl">🔢</div>
            <div className="font-black text-stone-700 dark:text-stone-100">
              Scoreline
            </div>
            <p className="text-xs font-medium text-stone-500 dark:text-stone-300">
              Best at nailing exact scores.
            </p>
          </div>
        </div>
      </section>

      {/* Good to know */}
      <section className="mb-10">
        <h2 className="mb-3 text-center text-xl font-black text-grape dark:text-violet-300">
          Good to know
        </h2>
        <ul className="mx-auto max-w-md space-y-2 text-sm font-medium text-stone-600 dark:text-stone-200">
          <li className="rounded-2xl glass px-4 py-3">
            ⏱️ Each day&apos;s games open for prediction{" "}
            <strong>the day before</strong> and close at kickoff — a countdown
            shows the time left.
          </li>
          <li className="rounded-2xl glass px-4 py-3">
            🔒 Everyone&apos;s picks stay hidden until kickoff, so there&apos;s no
            peeking.
          </li>
          <li className="rounded-2xl glass px-4 py-3">
            👨‍👩‍👧‍👦 In more than one group? You predict once and it counts in all of
            them.
          </li>
        </ul>
      </section>

      {/* CTA */}
      <div className="flex justify-center gap-3">
        <Link
          href="/join?mode=create"
          className="rounded-full glass px-6 py-3 font-bold text-pitch dark:text-emerald-400 transition active:scale-95"
        >
          Create a group
        </Link>
        <Link
          href="/join"
          className="rounded-full glass px-6 py-3 font-bold text-grape transition active:scale-95 dark:text-violet-300"
        >
          Join a group
        </Link>
      </div>
    </main>
  );
}
