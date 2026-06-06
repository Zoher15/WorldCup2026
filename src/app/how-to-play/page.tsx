import Link from "next/link";
import { Flag } from "@/components/Flag";
import { teamLabel } from "@/lib/fifa";
import { scoreMatch, ADVANCE_BONUS, MAX_MATCH_POINTS } from "@/lib/scoring";

export const metadata = {
  title: "How to play · World Cup 2026 Predictions",
};

/** A worked example: a pick vs a result, with points from the real engine. */
function Example({
  home,
  away,
  pick,
  result,
  tag,
}: {
  home: string;
  away: string;
  pick: [number, number];
  result: [number, number];
  tag: string;
}) {
  const s = scoreMatch(
    { homeGoals: pick[0], awayGoals: pick[1] },
    { homeGoals: result[0], awayGoals: result[1] },
  );
  const tone =
    s.total === MAX_MATCH_POINTS
      ? "bg-pitch text-white"
      : s.total === 0
        ? "bg-stone-300 text-stone-700"
        : "bg-sunburst text-stone-800";

  return (
    <div className="rounded-2xl bg-white/85 p-4 shadow ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-center gap-2 text-sm font-bold">
        <Flag code={home} size="sm" />
        <span className="truncate">{teamLabel(home)}</span>
        <span className="text-stone-300">v</span>
        <span className="truncate">{teamLabel(away)}</span>
        <Flag code={away} size="sm" />
      </div>
      <div className="flex items-center justify-center gap-4 text-sm font-bold">
        <span className="text-stone-500">
          You said{" "}
          <span className="text-grape">
            {pick[0]}–{pick[1]}
          </span>
        </span>
        <span className="text-stone-500">
          Result{" "}
          <span className="text-ocean">
            {result[0]}–{result[1]}
          </span>
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-stone-400">{tag}</span>
        <span className="text-xs font-medium text-stone-500">
          {s.outcome} outcome + {s.closeness} closeness
        </span>
        <span
          className={`rounded-full px-3 py-1 text-sm font-black ${tone}`}
        >
          {s.total} pts
        </span>
      </div>
    </div>
  );
}

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
    <div className="rounded-2xl bg-white/85 p-5 text-center shadow ring-1 ring-black/5">
      <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-grape text-lg font-black text-white">
        {n}
      </div>
      <div className="text-3xl">{emoji}</div>
      <h3 className="mt-1 font-black text-stone-700">{title}</h3>
      <p className="mt-1 text-sm font-medium text-stone-500">{children}</p>
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
        <div className="inline-flex items-center gap-2 rounded-full bg-pitch px-4 py-1.5 text-sm font-bold text-white shadow">
          ⚽ How to play
        </div>
        <h1 className="mt-3 bg-gradient-to-r from-flame via-grape to-ocean bg-clip-text text-4xl font-black tracking-tight text-transparent">
          Predict the scores. Beat the family.
        </h1>
        <p className="mt-2 font-medium text-stone-500">
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
        <h2 className="mb-3 text-center text-xl font-black text-grape">
          How points work
        </h2>
        <div className="rounded-3xl bg-white/85 p-6 text-center shadow-lg ring-1 ring-black/5">
          <p className="text-sm font-medium text-stone-500">
            Every match is worth up to{" "}
            <strong className="text-stone-700">
              {MAX_MATCH_POINTS} points
            </strong>
            , split two ways:
          </p>
          <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <div className="flex-1 rounded-2xl bg-flame/10 p-4">
              <div className="text-2xl font-black text-flame">up to 6</div>
              <div className="text-sm font-bold text-stone-700">Outcome</div>
              <p className="mt-1 text-xs font-medium text-stone-500">
                Right winner (or right draw) = 6. One step off = 3. Wrong = 0.
              </p>
            </div>
            <div className="flex-1 rounded-2xl bg-ocean/10 p-4">
              <div className="text-2xl font-black text-ocean">up to 4</div>
              <div className="text-sm font-bold text-stone-700">Closeness</div>
              <p className="mt-1 text-xs font-medium text-stone-500">
                Lose one point for each goal you&apos;re off the exact score.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Worked examples */}
      <section className="mb-10">
        <h2 className="mb-3 text-center text-xl font-black text-grape">
          See it in action
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Example
            home="BRA"
            away="ESP"
            pick={[2, 1]}
            result={[2, 1]}
            tag="Spot on 🎯"
          />
          <Example
            home="FRA"
            away="ENG"
            pick={[2, 0]}
            result={[2, 1]}
            tag="Right winner, one goal off"
          />
          <Example
            home="ARG"
            away="MEX"
            pick={[1, 1]}
            result={[2, 1]}
            tag="Called a draw, was a win"
          />
          <Example
            home="GER"
            away="USA"
            pick={[0, 2]}
            result={[2, 0]}
            tag="Wrong winner — ouch"
          />
        </div>
      </section>

      {/* Knockouts */}
      <section className="mb-10 rounded-3xl bg-grape/10 p-6 text-center">
        <div className="text-2xl">🥊</div>
        <h2 className="mt-1 text-lg font-black text-grape">Knockout bonus</h2>
        <p className="mx-auto mt-1 max-w-md text-sm font-medium text-stone-600">
          From the Round of 32 on, also pick who goes through. Get it right and
          it&apos;s{" "}
          <strong className="text-grape">+{ADVANCE_BONUS} bonus points</strong> —
          even if it took extra time or penalties.
        </p>
      </section>

      {/* Three boards */}
      <section className="mb-10">
        <h2 className="mb-3 text-center text-xl font-black text-grape">
          Three ways to win
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/85 p-4 text-center shadow ring-1 ring-black/5">
            <div className="text-2xl">🏆</div>
            <div className="font-black text-stone-700">Overall</div>
            <p className="text-xs font-medium text-stone-500">
              Your total points — the main prize.
            </p>
          </div>
          <div className="rounded-2xl bg-white/85 p-4 text-center shadow ring-1 ring-black/5">
            <div className="text-2xl">🎯</div>
            <div className="font-black text-stone-700">Win predictor</div>
            <p className="text-xs font-medium text-stone-500">
              Best at calling the right result.
            </p>
          </div>
          <div className="rounded-2xl bg-white/85 p-4 text-center shadow ring-1 ring-black/5">
            <div className="text-2xl">🔢</div>
            <div className="font-black text-stone-700">Scoreline</div>
            <p className="text-xs font-medium text-stone-500">
              Best at nailing exact scores.
            </p>
          </div>
        </div>
      </section>

      {/* Good to know */}
      <section className="mb-10">
        <h2 className="mb-3 text-center text-xl font-black text-grape">
          Good to know
        </h2>
        <ul className="mx-auto max-w-md space-y-2 text-sm font-medium text-stone-600">
          <li className="rounded-2xl bg-white/70 px-4 py-3">
            ⏱️ Each day&apos;s games open for prediction{" "}
            <strong>the day before</strong> and close at kickoff — a countdown
            shows the time left.
          </li>
          <li className="rounded-2xl bg-white/70 px-4 py-3">
            🔒 Everyone&apos;s picks stay hidden until kickoff, so there&apos;s no
            peeking.
          </li>
          <li className="rounded-2xl bg-white/70 px-4 py-3">
            👨‍👩‍👧‍👦 In more than one group? You predict once and it counts in all of
            them.
          </li>
        </ul>
      </section>

      {/* CTA */}
      <div className="flex justify-center gap-3">
        <Link
          href="/join?mode=create"
          className="rounded-full bg-pitch px-6 py-3 font-bold text-white shadow transition active:scale-95"
        >
          Create a group
        </Link>
        <Link
          href="/join"
          className="rounded-full bg-white px-6 py-3 font-bold text-grape shadow ring-1 ring-black/5 transition active:scale-95"
        >
          Join a group
        </Link>
      </div>
    </main>
  );
}
