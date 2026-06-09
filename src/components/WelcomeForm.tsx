"use client";

import { useActionState } from "react";
import { saveNameAction } from "@/app/welcome/actions";
import { INITIAL_WELCOME_STATE } from "@/app/welcome/welcome-state";
import { inputClasses as input } from "./form-styles";

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
