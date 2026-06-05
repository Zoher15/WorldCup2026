"use client";

import { useActionState } from "react";
import { adminLoginAction } from "@/app/admin/actions";

export function AdminLogin() {
  const [state, action, pending] = useActionState(adminLoginAction, {});
  return (
    <div className="mx-auto max-w-sm rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-black/5">
      <h1 className="mb-1 text-2xl font-black text-grape">Admin</h1>
      <p className="mb-4 text-sm text-stone-500">
        Enter the admin passcode to record match results.
      </p>
      <form action={action} className="space-y-3">
        <input
          name="passcode"
          type="password"
          autoComplete="off"
          placeholder="Passcode"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 font-medium outline-none focus:border-grape focus:ring-2 focus:ring-grape/30"
          required
        />
        {state.error && (
          <p className="text-sm font-bold text-flame">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-grape py-3 font-bold text-white shadow transition active:scale-95 disabled:opacity-50"
        >
          {pending ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
