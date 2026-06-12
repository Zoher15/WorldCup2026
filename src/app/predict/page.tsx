import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getPredictionBoard } from "@/lib/predictions";
import { PredictionList } from "@/components/PredictionList";
import { LoadError } from "@/components/LoadError";
import { FOCUS_RING } from "@/components/theme";

export const dynamic = "force-dynamic";

export default async function PredictPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/predict");

  let board;
  try {
    board = await getPredictionBoard(userId);
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load your predictions"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }
  const { matches, predictions } = board;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/"
        className={`rounded-md text-sm font-bold text-stone-400 ${FOCUS_RING}`}
      >
        ← Home
      </Link>
      <h1 className="mt-3 mb-1 gradient-text font-display pb-1 text-3xl leading-tight">
        Your predictions
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
        A day&apos;s games all open for prediction{" "}
        <strong>the day before</strong>, and each match closes at kickoff — watch
        the countdowns. Live games stay here with the score; your picks count in
        every group you&apos;re in.{" "}
        <Link
          href="/predict/past"
          className={`rounded-md font-bold text-grape underline-offset-2 hover:underline dark:text-violet-300 ${FOCUS_RING}`}
        >
          Past results →
        </Link>
      </p>

      {matches.length === 0 ? (
        <div className="rounded-2xl glass p-6 text-center">
          <div className="mb-2 text-4xl">⚽</div>
          <h2 className="text-lg font-black text-stone-700 dark:text-stone-100">
            No matches open right now
          </h2>
          <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-300">
            A day&apos;s games open for prediction the day before kickoff —
            check back then.
          </p>
          <Link
            href="/predict/past"
            className={`mt-4 inline-block rounded-full chrome px-6 py-3 font-bold text-pitch transition active:scale-95 dark:text-emerald-400 ${FOCUS_RING}`}
          >
            See your past results →
          </Link>
        </div>
      ) : (
        <PredictionList matches={matches} initial={predictions} />
      )}
    </main>
  );
}
