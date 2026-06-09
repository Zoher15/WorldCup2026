import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getPredictionBoard } from "@/lib/predictions";
import { PredictionList } from "@/components/PredictionList";
import { LoadError } from "@/components/LoadError";

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
      <Link href="/" className="text-sm font-bold text-stone-400">
        ← Home
      </Link>
      <h1 className="mt-3 mb-1 gradient-text pb-1 text-3xl font-black leading-tight">
        Your predictions
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
        A day&apos;s games all open for prediction{" "}
        <strong>the day before</strong>, and each match closes at kickoff — watch
        the countdowns. Your picks count in every group you&apos;re in.
      </p>

      {matches.length === 0 ? (
        <p className="rounded-2xl glass p-6 text-center font-medium text-stone-500 dark:text-stone-300">
          No upcoming matches to predict right now.
        </p>
      ) : (
        <PredictionList matches={matches} initial={predictions} />
      )}
    </main>
  );
}
