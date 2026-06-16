import { redirect } from "next/navigation";
import { getUserId } from "@/lib/identity";
import { getPastPredictionBoard } from "@/lib/predictions";
import { PastPredictionList } from "@/components/PastPredictionList";
import { LoadError } from "@/components/LoadError";
import { PageShell } from "@/components/PageShell";

export const dynamic = "force-dynamic";

export default async function PastPredictionsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/predict/past");

  let matches;
  try {
    matches = await getPastPredictionBoard(userId);
  } catch (e) {
    return (
      <LoadError
        title="Couldn't load your past predictions"
        message={e instanceof Error ? e.message : String(e)}
      />
    );
  }

  return (
    <PageShell width="content" back={{ href: "/predict", label: "Predictions" }}>
      <h1 className="mb-1 gradient-text font-display pb-1 text-3xl leading-tight tracking-tight">
        Past results
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-300">
        Every match you&apos;ve predicted that&apos;s finished — your call beside
        the full-time score. Tap a card for the points math.
      </p>

      {matches.length === 0 ? (
        <div className="rounded-2xl glass p-6 text-center font-medium text-stone-300">
          <div className="mb-2 text-4xl">⚽</div>
          No finished matches yet — they&apos;ll appear here after kickoff.
        </div>
      ) : (
        <PastPredictionList matches={matches} />
      )}
    </PageShell>
  );
}
