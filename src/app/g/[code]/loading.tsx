/** Glass skeleton shown while a group loads: the header panel, the leaderboard
 *  card (podium bars and rows) and the match list, mirroring the page layout. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8" aria-busy>
      <span className="sr-only">Loading this group…</span>
      <div className="animate-pulse" aria-hidden>
        <div className="h-4 w-16 rounded-full glass" />
        {/* Group header: name, join code pill, invite link and predict CTA. */}
        <div className="mt-4 h-56 rounded-3xl glass" />
        {/* Leaderboard: tab pill, podium (winner tallest in the middle), rows. */}
        <div className="mt-6 rounded-3xl glass p-5">
          <div className="mx-auto h-9 w-64 max-w-full rounded-full glass" />
          <div className="mt-5 flex items-end justify-center gap-3">
            <div className="h-20 w-20 rounded-t-xl glass" />
            <div className="h-28 w-20 rounded-t-xl glass" />
            <div className="h-16 w-20 rounded-t-xl glass" />
          </div>
          <div className="mt-5 space-y-2">
            <div className="h-12 rounded-2xl glass" />
            <div className="h-12 rounded-2xl glass" />
            <div className="h-12 rounded-2xl glass" />
            <div className="h-12 rounded-2xl glass" />
            <div className="h-12 rounded-2xl glass" />
          </div>
        </div>
        {/* The match list: rows linking to each per-match leaderboard. */}
        <div className="mt-6 rounded-3xl glass p-5">
          <div className="space-y-2">
            <div className="h-11 rounded-2xl glass" />
            <div className="h-11 rounded-2xl glass" />
            <div className="h-11 rounded-2xl glass" />
          </div>
        </div>
      </div>
    </main>
  );
}
