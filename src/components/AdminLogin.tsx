"use client";

import { useActionState } from "react";
import { adminLoginAction } from "@/app/admin/actions";

export function AdminLogin() {
  const [state, action, pending] = useActionState(adminLoginAction, {});
  return (
    <div className="mx-auto max-w-sm rounded-3xl glass p-6">
      <h1 className="mb-1 text-2xl font-black text-grape dark:text-violet-300">Admin</h1>
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-300">
        Enter the admin passcode to record match results.
      </p>
      <form action={action} className="space-y-3">
        <input
          name="passcode"
          type="password"
          autoComplete="off"
          placeholder="Passcode"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 font-medium outline-none focus:border-grape focus:ring-2 focus:ring-grape/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
          required
        />
        {state.error && (
          <p className="text-sm font-bold text-flame">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full glass py-3 font-bold text-grape dark:text-violet-300 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
