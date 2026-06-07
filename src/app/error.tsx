"use client";

/**
 * Last-resort error boundary for anything we don't catch explicitly. In
 * production Next.js redacts the real message (only `error.digest` survives),
 * so the per-page try/catch around data loads is what surfaces the true cause;
 * this just keeps users out of the raw "Application error" screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="text-4xl">😵</div>
      <h1 className="mt-3 text-xl font-black text-flame">Something went wrong</h1>
      <p className="mt-2 text-sm font-medium text-stone-500 dark:text-stone-300">
        Sorry — that didn&apos;t load. Try again in a moment.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-stone-400">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-pitch px-6 py-3 font-bold text-white shadow transition active:scale-95"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-full bg-white px-6 py-3 font-bold text-grape shadow ring-1 ring-black/5 transition active:scale-95 dark:bg-stone-800 dark:text-violet-300 dark:ring-white/10"
        >
          Home
        </a>
      </div>
    </main>
  );
}
