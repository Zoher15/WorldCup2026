import Link from "next/link";
import { Icon } from "@/components/Icon";
import { HowToPlayDemo } from "@/components/HowToPlayDemo";
import { KnockoutAdvanceDemo } from "@/components/KnockoutAdvanceDemo";
import { MAX_MATCH_POINTS, SCORE_MULTIPLIER } from "@/lib/scoring";
import { BORINGBOT_NAME } from "@/lib/standings";
import { PageShell } from "@/components/PageShell";
import type { Stage } from "@/lib/types";

export const metadata = {
  title: "How to play · World Cup 2026 Predictions",
};

// The multiplier ladder, shown as chips so players can see every rung — group
// (the ×1 baseline) through the final — and what a flawless call is worth at
// each. Labels live here; the multipliers come from SCORE_MULTIPLIER so the
// numbers can never drift from the scoring engine. (Third place rides with the
// quarter-finals at ×4 and is left off this headline ladder.)
const MULTIPLIER_LADDER: { stage: Stage; label: string }[] = [
  { stage: "group", label: "Group" },
  { stage: "round_of_32", label: "R32" },
  { stage: "round_of_16", label: "R16" },
  { stage: "quarter_final", label: "QF" },
  { stage: "semi_final", label: "SF" },
  { stage: "final", label: "Final" },
];

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
      <h3 className="mt-1 font-black text-stone-100">{title}</h3>
      <p className="mt-1 text-sm font-medium text-stone-300">
        {children}
      </p>
    </div>
  );
}

export default function HowToPlayPage() {
  return (
    <PageShell width="content" back={{ href: "/", label: "Home" }}>
      <header className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm font-bold text-emerald-400">
          ⚽ How to play
        </div>
        <h1 className="mt-3 gradient-text font-display pb-1 text-4xl leading-tight tracking-tight sm:text-5xl">
          Predict the scores. Beat your group.
        </h1>
        <p className="mt-2 font-medium text-stone-300">
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
        <h2 className="gradient-text mb-3 text-center text-xl font-black">
          How points work
        </h2>
        <div className="rounded-3xl glass p-6 text-center">
          <p className="text-sm font-medium text-stone-300">
            Every group match is worth up to{" "}
            <strong className="text-stone-100">
              {MAX_MATCH_POINTS} points
            </strong>
            , split two ways:
          </p>
          <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <div className="flex-1 rounded-2xl glass p-4">
              <div className="text-2xl font-black text-flame">up to 5</div>
              <div className="text-sm font-bold text-stone-100">
                Outcome
              </div>
              <p className="mt-1 text-xs font-medium text-stone-300">
                Did you call it right? <strong>5</strong> for the correct result
                (win, lose, or draw), <strong>2</strong> if you&apos;re close (you
                said draw but a team won, or the other way round),{" "}
                <strong>0</strong> for backing the wrong team.
              </p>
            </div>
            <div className="flex-1 rounded-2xl glass p-4">
              <div className="text-2xl font-black text-sky-400">up to 5</div>
              <div className="text-sm font-bold text-stone-100">
                Closeness
              </div>
              <p className="mt-1 text-xs font-medium text-stone-300">
                How near was your score? Start at <strong>5</strong> and lose a
                point for every goal you&apos;re off. Spot on keeps all 5.
              </p>
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-md text-xs font-medium text-stone-300">
            <strong className="text-stone-100">Say the match ends 2–1.</strong>{" "}
            Predict <strong>2–1</strong> and you score the full <strong>10</strong>.
            Predict <strong>3–1</strong> — right winner (5) but one goal off (4) ={" "}
            <strong>9</strong>. Predict <strong>1–1</strong> — a draw guess (2),
            two goals off (3) = <strong>5</strong>.
          </p>
        </div>
      </section>

      {/* Interactive walkthrough */}
      <section className="mb-10">
        <h2 className="gradient-text mb-1 text-center text-xl font-black">
          Try it yourself
        </h2>
        <p className="mx-auto mb-4 max-w-md text-center text-sm font-medium text-stone-300">
          Call the score for this match, lock it in, and see how you&apos;d stack
          up against the family.
        </p>
        <HowToPlayDemo />
      </section>

      {/* Knockouts */}
      <section className="mb-10">
        <h2 className="gradient-text mb-1 text-center text-xl font-black">
          Knockouts count for more
        </h2>
        <p className="mx-auto mb-4 max-w-md text-center text-sm font-medium text-stone-300">
          Points work exactly the same — Outcome plus Closeness, up to{" "}
          {MAX_MATCH_POINTS} a game — then the whole match is multiplied, and the
          multiplier climbs every round.
        </p>

        <div className="rounded-3xl glass p-6">
          {/* The ladder, rung by rung: each round's multiplier and what a
              flawless call is worth there. The final towers over the group. */}
          <div className="flex flex-wrap items-stretch justify-center gap-2">
            {MULTIPLIER_LADDER.map(({ stage, label }) => {
              const mult = SCORE_MULTIPLIER[stage];
              const isGroup = stage === "group";
              const isFinal = stage === "final";
              return (
                <div
                  key={stage}
                  className={`flex min-w-[4rem] flex-1 flex-col items-center rounded-2xl glass px-2 py-3 ${
                    isFinal ? "ring-1 ring-flame/40" : ""
                  }`}
                >
                  <span
                    className={`font-display text-2xl leading-none ${
                      isGroup
                        ? "text-stone-300"
                        : isFinal
                          ? "text-flame"
                          : "text-violet-300"
                    }`}
                  >
                    ×{mult}
                  </span>
                  <span className="mt-1.5 text-center text-[11px] font-black uppercase tracking-wide text-stone-200">
                    {label}
                  </span>
                  <span className="text-[10px] font-medium text-stone-400">
                    up to {MAX_MATCH_POINTS * mult}
                  </span>
                </div>
              );
            })}
          </div>

          {/* A worked example, mirroring the group-stage "say it ends 2–1" one. */}
          <p className="mx-auto mt-5 max-w-md text-center text-xs font-medium text-stone-300">
            <strong className="text-stone-100">
              Call a Round-of-16 game 2–1 and it ends 2–1.
            </strong>{" "}
            That&apos;s the full {MAX_MATCH_POINTS}, then ×
            {SCORE_MULTIPLIER.round_of_16} for the round ={" "}
            <strong className="text-emerald-400">
              {MAX_MATCH_POINTS * SCORE_MULTIPLIER.round_of_16}
            </strong>
            . The same perfect call in the final banks{" "}
            <strong className="text-emerald-400">
              {MAX_MATCH_POINTS * SCORE_MULTIPLIER.final}
            </strong>
            . Add it up and the knockouts outweigh the entire group stage — a hot
            run can overturn a group-stage lead.
          </p>
        </div>

        {/* Extra time & penalties — spell out exactly which scoreline feeds
            each half, since this is the part players ask about most. */}
        <div className="mt-4 rounded-3xl glass p-6">
          <div className="text-center">
            <div className="text-2xl">🥊</div>
            <h3 className="gradient-text mt-1 text-lg font-black">
              Extra time &amp; penalties
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm font-medium text-stone-200">
              A knockout can&apos;t end level — so which score counts? The match is
              recorded at the score{" "}
              <strong className="text-stone-100">after extra time</strong>:
              extra-time goals count, but a penalty shootout never changes the
              scoreline. A tie won on penalties is recorded as the draw it was on
              the pitch — say <strong className="text-stone-100">1–1</strong>.
              Here&apos;s how that score feeds your two point halves:
            </p>
          </div>
          <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row">
            <div className="flex-1 rounded-2xl glass p-4 text-center">
              <div className="text-sm font-bold text-flame">Outcome</div>
              <p className="mt-1 text-xs font-medium text-stone-300">
                The team that <strong>goes through</strong> counts as the winner,
                even on penalties. Back them with a decisive call and you bank the
                full <strong>5</strong> — even if the game finished level. Predict
                a <strong>draw</strong>? Pick who you think advances, and that pick
                is graded like backing them to win: right team through scores the
                full <strong>5</strong>, the wrong one <strong>0</strong>. Skip the
                pick and a bare draw is one step off, for <strong>2</strong>.
              </p>
            </div>
            <div className="flex-1 rounded-2xl glass p-4 text-center">
              <div className="text-sm font-bold text-sky-400">Closeness</div>
              <p className="mt-1 text-xs font-medium text-stone-300">
                Always measured against that{" "}
                <strong>after-extra-time</strong> score — the shootout is ignored.
                Nail <strong>1–1</strong> on a tie won by penalties and you still
                pocket all <strong>5</strong> for closeness.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive knockout example — its own walkthrough, mirroring the
          group-stage "Try it yourself" one, but for the draw-then-pick-who-
          advances twist that only knockouts have. */}
      <section className="mb-10">
        <h2 className="gradient-text mb-1 text-center text-xl font-black">
          Try a knockout tie
        </h2>
        <p className="mx-auto mb-4 max-w-md text-center text-sm font-medium text-stone-300">
          A knockout can&apos;t end level. Call this one a <strong>draw</strong> and
          a <strong>who-goes-through</strong> picker appears — back a side and your
          pick is graded like calling the winner. Tap the teams to see it land.
        </p>
        <KnockoutAdvanceDemo />
      </section>

      {/* BoringBot */}
      <section className="mb-10 rounded-3xl glass p-6 text-center">
        <div className="text-2xl">🤖</div>
        <h2 className="gradient-text mt-1 text-lg font-black">
          Beat {BORINGBOT_NAME}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm font-medium text-stone-200">
          Every group has one extra competitor:{" "}
          <strong className="text-violet-300">
            {BORINGBOT_NAME}
          </strong>
          , which stubbornly predicts <strong>0–0</strong> in every single match.
          It sits on your leaderboard as the line to beat — finish above the bot
          and you&apos;ve proven you know more than nothing. Tap its name to see
          its picks.
        </p>
      </section>

      {/* Three boards */}
      <section className="mb-10">
        <h2 className="gradient-text mb-3 text-center text-xl font-black">
          Three ways to win
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl glass p-4 text-center">
            <div className="text-2xl">🏆</div>
            <div className="font-black text-stone-100">Overall</div>
            <p className="text-xs font-medium text-stone-300">
              Your total points — the main prize.
            </p>
          </div>
          <div className="rounded-2xl glass p-4 text-center">
            <div className="text-2xl">🎯</div>
            <div className="font-black text-stone-100">
              Outcome predictor
            </div>
            <p className="text-xs font-medium text-stone-300">
              Best at calling the right result.
            </p>
          </div>
          <div className="rounded-2xl glass p-4 text-center">
            <div className="text-2xl">🔢</div>
            <div className="font-black text-stone-100">
              Scoreline
            </div>
            <p className="text-xs font-medium text-stone-300">
              Best at nailing exact scores.
            </p>
          </div>
        </div>
      </section>

      {/* Good to know */}
      <section className="mb-10">
        <h2 className="gradient-text mb-3 text-center text-xl font-black">
          Good to know
        </h2>
        <ul className="mx-auto max-w-md space-y-2 text-sm font-medium text-stone-200">
          <li className="rounded-2xl glass px-4 py-3">
            ⏱️ Group-stage games open for prediction{" "}
            <strong>the day before</strong>, and each knockout round opens{" "}
            <strong>all at once</strong> — the whole Round of 32, then the Round
            of 16, and so on. Every game still closes at its own kickoff, with a
            countdown showing the time left.
          </li>
          <li className="rounded-2xl glass px-4 py-3">
            <Icon name="lock" className="mr-1 text-stone-300" /> Everyone&apos;s
            picks stay hidden until kickoff, so there&apos;s no peeking.
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
          className="rounded-full glass px-6 py-3 font-bold text-emerald-400 transition active:scale-95"
        >
          Create a group
        </Link>
        <Link
          href="/join"
          className="rounded-full glass px-6 py-3 font-bold text-violet-300 transition active:scale-95"
        >
          Join a group
        </Link>
      </div>
    </PageShell>
  );
}
