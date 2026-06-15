"use client";

import { use, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { sendMagicLinkAction, verifyEmailOtpAction } from "./actions";
import { INITIAL_LOGIN_STATE, INITIAL_VERIFY_STATE } from "./login-state";
import { inputClasses } from "@/components/form-styles";
import { FOCUS_RING } from "@/components/theme";

// The OTP field is a one-off (big centered digits), styled dark-only like
// form-styles.ts since the app forces dark mode.
const codeInput =
  "w-full rounded-xl border border-stone-600 bg-stone-800 px-4 py-3 text-center text-2xl font-black tracking-[0.5em] text-stone-100 outline-none placeholder:text-stone-600 focus:border-pitch focus:ring-2 focus:ring-pitch/50";

/** A human estimate for the queued-code wait, e.g. "1 minute" or "3 minutes". */
function etaText(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return mins === 1 ? "1 minute" : `${mins} minutes`;
}

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

  // Resend cooldown (matches the server's 2-minute throttle). A fresh send opens
  // a full window; a throttled resend comes back with the server's remaining time.
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (state.status !== "sent") return;
    setCooldown(state.retryAfter ?? 120);
  }, [state]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Link href="/" className={`rounded-md text-sm font-bold text-stone-400 ${FOCUS_RING}`}>
        ← Home
      </Link>
      <h1 className="mt-3 mb-2 gradient-text font-display pb-1 text-3xl leading-tight tracking-tight">
        Sign in
      </h1>
      <p className="mb-6 text-sm font-medium text-stone-300">
        Enter your email and we&apos;ll send you a sign-in code — no password to
        remember. You&apos;ll stay signed in on this device.
      </p>

      {state.status === "sent" ? (
        <div className="animate-pop-in rounded-3xl glass p-6">
          <div className="text-center text-4xl">📬</div>
          <h2 className="mt-2 text-center text-xl font-black text-emerald-400">
            Check your email
          </h2>
          <p className="mt-1 text-center text-sm text-stone-300">
            We sent a code to <strong>{state.email}</strong>. Enter it below to
            sign in.
          </p>

          {state.etaSeconds ? (
            <p className="mt-3 rounded-2xl glass px-4 py-3 text-center text-sm text-stone-300">
              📨 Lots of people are signing in right now, so codes are going out in
              turn. Yours should arrive in about{" "}
              <strong>{etaText(state.etaSeconds)}</strong> — keep this tab open and
              enter it here when it lands.
            </p>
          ) : null}

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
              className="w-full rounded-full glass py-3.5 text-lg font-bold text-emerald-400 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifying ? "Signing you in…" : "Verify & sign in"}
            </button>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-stone-400">
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
              disabled={pending || cooldown > 0}
              className="text-sm font-bold text-violet-300 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cooldown > 0
                ? `Resend code in ${mmss(cooldown)}`
                : pending
                  ? "Sending a new code…"
                  : "Didn't get it? Resend code"}
            </button>
            {state.error && (
              <p className="mt-2 text-xs font-medium text-stone-400">{state.error}</p>
            )}
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
            className={inputClasses}
            placeholder="you@example.com"
            required
          />
          {state.status === "error" && (
            <p className="text-sm font-bold text-flame">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full glass py-3.5 text-lg font-bold text-emerald-400 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}
    </main>
  );
}
