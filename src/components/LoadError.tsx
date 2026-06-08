/**
 * Friendly full-page fallback for a server-side data-load failure. We render the
 * real error message as normal page content (caught in the page, not thrown) so
 * the cause is visible instead of Next.js hiding it behind a bare "Application
 * error" digest screen.
 */
export function LoadError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="text-4xl">⚠️</div>
      <h1 className="mt-3 text-xl font-black text-flame">{title}</h1>
      <p className="mt-3 break-words rounded-2xl glass p-4 text-left text-sm font-medium text-stone-600 dark:text-stone-300">
        {message}
      </p>
      <a
        href="/"
        className="mt-6 inline-block rounded-full bg-pitch px-6 py-3 font-bold text-white shadow transition active:scale-95"
      >
        ← Back home
      </a>
    </main>
  );
}
