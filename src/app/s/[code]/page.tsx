import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGroupStandings } from "@/lib/groups";
import { BORINGBOT_ID } from "@/lib/standings";

export const dynamic = "force-dynamic";

// Public share landing. The leaderboard PNG lives in opengraph-image.tsx in this
// same segment, which Next automatically wires up as this page's OG/Twitter
// image — so pasting /s/<code> into a chat unfurls into the podium picture.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const data = await getGroupStandings(code);
  const name = data?.group.name ?? "World Cup 2026";
  const title = `${name} · Leaderboard`;
  const description =
    "World Cup 2026 score & winner predictions — see who's topping the leaderboard, then tap in to make your own picks.";
  // Version the OG image URL per deploy. The image's CDN cache key is otherwise
  // identical across deploys, so a once-cached bad render would survive forever;
  // a new `?v=` each deploy guarantees crawlers fetch a fresh render.
  const ver = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "1";
  const image = `/s/${code}/opengraph-image?v=${ver}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "World Cup 2026 Predictions",
      images: [{ url: image, width: 1200, height: 630, alt: "World Cup 2026 leaderboard" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function SharePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await getGroupStandings(code);
  if (!data) notFound();

  const rows = data.standings.overall.slice(0, 8);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <header className="mb-6 rounded-3xl glass p-6 text-center">
        <div className="text-3xl">🏆</div>
        <h1 className="mt-1 text-2xl font-black text-grape dark:text-violet-300">
          {data.group.name}
        </h1>
        <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-300">
          World Cup 2026 · Leaderboard
        </p>
      </header>

      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.userId}
            className="flex items-center gap-3 rounded-2xl glass px-4 py-2.5 text-stone-700 dark:text-stone-100"
          >
            <span className="w-7 text-center text-lg font-black">
              {MEDALS[i] ?? <span className="text-stone-400">{i + 1}</span>}
            </span>
            <span className="flex-1 truncate font-bold">
              {r.displayName}
              {r.userId === BORINGBOT_ID && (
                <span className="ml-1.5 text-xs font-bold text-stone-400">bot</span>
              )}
            </span>
            <span className="w-10 text-right text-lg font-extrabold tabular-nums">
              {r.points}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex justify-center">
        <Link
          href={`/g/${data.group.code}`}
          className="rounded-full glass px-6 py-3 font-bold text-pitch transition active:scale-95 dark:text-emerald-400"
        >
          Open the full leaderboard →
        </Link>
      </div>
    </main>
  );
}
