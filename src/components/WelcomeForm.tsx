"use client";

import { useActionState } from "react";
import { saveNameAction } from "@/app/welcome/actions";
import { INITIAL_WELCOME_STATE } from "@/app/welcome/welcome-state";

const input =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base font-medium outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500";

export function WelcomeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(
    saveNameAction,
    INITIAL_WELCOME_STATE,
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <input
        name="name"
        className={input}
        placeholder="Zoher Kachwala"
        autoComplete="name"
        autoFocus
        required
      />
      {state.error && (
        <p className="text-sm font-bold text-flame">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full glass py-3.5 text-lg font-bold text-pitch transition active:scale-95 disabled:opacity-50 dark:text-emerald-400"
      >
        {pending ? "Saving…" : "Continue →"}
      </button>
    </form>
  );
}
