import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupView } from "@/lib/groups";
import { Leaderboard } from "@/components/Leaderboard";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const view = await getGroupView(code);
  if (!view) notFound();

  // Until predictions are scored, everyone sits at zero — real standings will
  // come from the scoring engine. The board renders the same either way.
  const rows = view.members.map((m) => ({
    displayName: m.displayName,
    points: 0,
    movement: 0,
  }));
  const board = { overall: rows, win: rows, scoreline: rows };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm font-bold text-stone-400">
        ← Home
      </Link>

      <header className="mt-3 mb-6 rounded-3xl bg-white/85 p-6 text-center shadow-lg ring-1 ring-black/5">
        <h1 className="text-3xl font-black text-grape">{view.group.name}</h1>
        <p className="mt-1 text-sm font-medium text-stone-500">
          Invite others with the code
        </p>
        <div className="mt-2 inline-block rounded-2xl bg-cream px-6 py-2 text-2xl font-black tracking-[0.25em] text-flame">
          {view.group.code}
        </div>
        <p className="mt-3 text-xs text-stone-400">
          {view.members.length}{" "}
          {view.members.length === 1 ? "member" : "members"} ·{" "}
          {view.group.lateJoinPolicy === "carry_over"
            ? "late joiners keep earlier predictions"
            : "everyone starts even"}
        </p>
      </header>

      <Leaderboard data={board} />

      <p className="mt-8 text-center text-xs text-stone-400">
        Predictions and live scoring are wired up next — the leaderboard will
        come alive once matches begin.
      </p>
    </main>
  );
}
