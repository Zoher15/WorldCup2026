/** Glass skeleton shown while a group loads: the header panel, the leaderboard
 *  card and the match list, mirroring the page layout. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8" aria-busy>
      <span className="sr-only">Loading this group…</span>
      <div className="animate-pulse" aria-hidden>
        <div className="h-4 w-16 rounded-full glass" />
        <div className="mt-4 h-56 rounded-3xl glass" />
        <div className="mt-6 h-96 rounded-3xl glass" />
        <div className="mt-6 h-48 rounded-3xl glass" />
      </div>
    </main>
  );
}
