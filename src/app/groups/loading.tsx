/** Glass skeleton shown while the groups list loads: a heading bar over a few
 *  row-shaped blocks, mirroring the page layout. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-nav" aria-busy>
      <span className="sr-only">Loading your groups…</span>
      <div className="animate-pulse" aria-hidden>
        <div className="h-9 w-44 rounded-xl glass" />
        <div className="mt-5 space-y-3">
          <div className="h-[4.5rem] rounded-2xl glass" />
          <div className="h-[4.5rem] rounded-2xl glass" />
          <div className="h-[4.5rem] rounded-2xl glass" />
        </div>
        <div className="mt-5 h-12 w-36 rounded-full glass" />
      </div>
    </main>
  );
}
