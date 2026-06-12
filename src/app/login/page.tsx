"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { sendMagicLinkAction, verifyEmailOtpAction } from "./actions";
import { INITIAL_LOGIN_STATE, INITIAL_VERIFY_STATE } from "./login-state";
import { FOCUS_RING } from "@/components/theme";

// Dark-only fields, like form-styles.ts: the app forces dark mode, so there
// are no light/`dark:` pairs that could flash a white field.
const input =
  "w-full rounded-xl border border-stone-600 bg-stone-800 px-4 py-3 text-base font-medium text-stone-100 outline-none placeholder:text-stone-500 focus:border-pitch focus:ring-2 focus:ring-pitch/50";

const codeInput =
  "w-full rounded-xl border border-stone-600 bg-stone-800 px-4 py-3 text-center text-2xl font-black tracking-[0.5em] text-stone-100 outline-none placeholder:text-stone-600 focus:border-pitch focus:ring-2 focus:ring-pitch/50";

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
  const [verify, verifyAction, verifying] = useActionState(
    verifyEmailOtpAction,
    INITIAL_VERIFY_STATE,
  );

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Link href="/" className={`rounded-md text-sm font-bold text-stone-400 ${FOCUS_RING}`}>
        ← Home
      </Link>
      <h1 className="mt-3 mb-2 gradient-text font-display pb-1 text-3xl leading-tight">
        Sign in
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-500 dark:text-stone-300">
        Enter your email and we&apos;ll send you a sign-in code — no password to
        remember. You&apos;ll stay signed in on this device.
      </p>

      {state.status === "sent" ? (
        <div className="animate-pop-in rounded-3xl glass p-6">
          <div className="text-center text-4xl">📬</div>
          <h2 className="mt-2 text-center text-xl font-black text-pitch dark:text-emerald-400">
            Check your email
          </h2>
          <p className="mt-1 text-center text-sm text-stone-500 dark:text-stone-300">
            We sent a code to <strong>{state.email}</strong>. Enter it below to
            sign in.
          </p>

          <form action={verifyAction} className="mt-5 space-y-3">
            <input type="hidden" name="email" value={state.email} />
            <input type="hidden" name="next" value={next ?? "/"} />
            <input
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              className={codeInput}
              placeholder="••••••••"
              aria-label="Sign-in code"
              required
              autoFocus
            />
            {verify.status === "error" && (
              <p className="text-sm font-bold text-flame">{verify.error}</p>
            )}
            <button
              type="submit"
              disabled={verifying}
              className="w-full rounded-full glass py-3.5 text-lg font-bold text-pitch dark:text-emerald-400 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifying ? "Signing you in…" : "Verify & sign in"}
            </button>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-stone-400 dark:text-stone-400">
            Entering the code keeps you in <strong>this</strong> browser. The
            email also has a tap-to-sign-in link — but if you tap it, it opens in
            your phone&apos;s default browser, so use the code here if you want to
            play in this one.
          </p>

          <form action={action} className="mt-5 text-center">
            <input type="hidden" name="email" value={state.email} />
            <input type="hidden" name="next" value={next ?? "/"} />
            <button
              type="submit"
              disabled={pending}
              className="text-sm font-bold text-grape underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-violet-300"
            >
              {pending ? "Sending a new code…" : "Didn't get it? Resend code"}
            </button>
          </form>
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
            className="w-full rounded-full glass py-3.5 text-lg font-bold text-pitch dark:text-emerald-400 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}
    </main>
  );
}
