/** Glass skeleton shown while the predictions board loads: heading bars over a
 *  two-column run of match-card-shaped blocks, mirroring the page layout. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8" aria-busy>
      <span className="sr-only">Loading your predictions…</span>
      <div className="animate-pulse" aria-hidden>
        <div className="h-4 w-16 rounded-full glass" />
        <div className="mt-4 h-9 w-56 rounded-xl glass" />
        <div className="mt-3 h-4 w-full max-w-md rounded-full glass" />
        <div className="mt-8 h-4 w-32 rounded-full glass" />
        <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="h-36 rounded-2xl glass" />
          <div className="h-36 rounded-2xl glass" />
          <div className="h-36 rounded-2xl glass" />
          <div className="h-36 rounded-2xl glass" />
        </div>
        {/* The sticky save bar: status text and save-button placeholders. */}
        <div className="fixed inset-x-0 bottom-0 z-10 glass glass-frost px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="h-4 w-24 rounded-full glass" />
            <div className="h-12 w-44 rounded-full glass" />
          </div>
        </div>
      </div>
    </main>
  );
}
