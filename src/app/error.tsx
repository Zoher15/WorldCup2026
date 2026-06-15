"use client";

/**
 * Last-resort error boundary for anything we don't catch explicitly.
 *
 * Next.js redacts the message for *server* render errors in production (only
 * `error.digest` survives), but *client*-side error messages come through
 * intact — so we surface message + digest here to make the cause visible
 * instead of swallowing it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const redacted =
    !error.message ||
    error.message.includes("omitted in production") ||
    error.message.includes("Server Components render");

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="text-4xl">😵</div>
      <h1 className="mt-3 text-xl font-black text-flame">Something went wrong</h1>
      <p className="mt-2 text-sm font-medium text-stone-300">
        Sorry — that didn&apos;t load.
      </p>

      <div className="mt-4 break-words rounded-2xl glass p-4 text-left text-xs font-medium text-stone-200">
        {redacted ? (
          <p>
            A server-side error was hidden by the production build. Reference{" "}
            <span className="font-bold">{error.digest ?? "—"}</span> — the full
            message is in the Vercel function logs for this request.
          </p>
        ) : (
          <>
            <p className="font-bold text-flame">{error.message}</p>
            {error.digest && (
              <p className="mt-1 text-stone-400">digest: {error.digest}</p>
            )}
            {error.stack && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] leading-snug text-stone-400">
                {error.stack}
              </pre>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full glass px-6 py-3 font-bold text-emerald-400 transition active:scale-95"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-full glass px-6 py-3 font-bold text-violet-300 transition active:scale-95"
        >
          Home
        </a>
      </div>
    </main>
  );
}
