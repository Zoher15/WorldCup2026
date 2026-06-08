"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { sendMagicLinkAction } from "./actions";
import { INITIAL_LOGIN_STATE } from "./login-state";

const input =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base font-medium outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next } = use(searchParams);
  const [state, action, pending] = useActionState(
    sendMagicLinkAction,
    INITIAL_LOGIN_STATE,
  );

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Link href="/" className="text-sm font-bold text-stone-400">
        ← Home
      </Link>
      <h1 className="mt-3 mb-2 bg-gradient-to-r from-flame to-grape bg-clip-text text-3xl font-black text-transparent">
        Sign in
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
        Enter your email and we&apos;ll send you a magic link — no password to
        remember. You&apos;ll stay signed in on this device.
      </p>

      {state.status === "sent" ? (
        <div className="animate-pop-in rounded-3xl glass p-6 text-center">
          <div className="text-4xl">📬</div>
          <h2 className="mt-2 text-xl font-black text-pitch dark:text-emerald-400">Check your email</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-300">
            We sent a sign-in link to <strong>{state.email}</strong>. Open it on
            this device to continue.
          </p>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/"} />
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={input}
            placeholder="you@example.com"
            required
          />
          {state.status === "error" && (
            <p className="text-sm font-bold text-flame">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-pitch py-3.5 text-lg font-bold text-white shadow transition active:scale-95 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}
    </main>
  );
}
