import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getPredictionBoard } from "@/lib/predictions";
import { PredictionList } from "@/components/PredictionList";
import { EmptyState } from "@/components/EmptyState";
import { LoadError } from "@/components/LoadError";
import { PageShell } from "@/components/PageShell";
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

  // The save bar only mounts when there are matches to predict; reserve its
  // clearance only then, otherwise just the tab bar.
  const bottomInset = matches.length === 0 ? "nav" : "nav-savebar";

  return (
    <PageShell width="content" back={{ href: "/", label: "Home" }} bottomInset={bottomInset}>
      <h1 className="mb-1 gradient-text font-display pb-1 text-3xl leading-tight tracking-tight">
        Your predictions
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-300">
        A day&apos;s games all open for prediction{" "}
        <strong>the day before</strong>, and each match closes at kickoff — watch
        the countdowns. Live games stay here with the score; your picks count in
        every group you&apos;re in.{" "}
        <Link
          href="/predict/past"
          className={`rounded-md font-bold text-violet-300 underline-offset-2 hover:underline ${FOCUS_RING}`}
        >
          Past results →
        </Link>{" "}
        <Link
          href="/t"
          className={`rounded-md font-bold text-violet-300 underline-offset-2 hover:underline ${FOCUS_RING}`}
        >
          Browse teams →
        </Link>
      </p>

      {matches.length === 0 ? (
        <EmptyState
          icon="⚽"
          title="No matches open right now"
          hint="A day's games open for prediction the day before kickoff — check back then."
          href="/predict/past"
          cta="See your past results →"
        />
      ) : (
        <PredictionList matches={matches} initial={predictions} />
      )}
    </PageShell>
  );
}
