/** Glass skeleton shown while a player profile loads: the header panel over a
 *  run of match-card-shaped blocks, mirroring the page layout. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8" aria-busy>
      <span className="sr-only">Loading this player…</span>
      <div className="animate-pulse" aria-hidden>
        <div className="h-4 w-24 rounded-full glass" />
        <div className="mt-4 h-48 rounded-3xl glass" />
        <div className="mt-8 h-4 w-28 rounded-full glass" />
        <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="h-36 rounded-2xl glass" />
          <div className="h-36 rounded-2xl glass" />
          <div className="h-36 rounded-2xl glass" />
          <div className="h-36 rounded-2xl glass" />
        </div>
      </div>
    </main>
  );
}
