"use client";

import { use, useActionState, useState } from "react";
import Link from "next/link";
import {
  createGroupAction,
  joinGroupAction,
  INITIAL_JOIN_STATE,
  type JoinState,
} from "@/app/actions";

const input =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base font-medium outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500";
const label = "mb-1 block text-sm font-bold text-stone-600 dark:text-stone-300";

function Success({ state }: { state: JoinState }) {
  return (
    <div className="animate-pop-in rounded-3xl bg-white/90 p-6 text-center shadow-lg ring-1 ring-black/5 dark:bg-stone-800/90 dark:ring-white/10">
      <div className="text-4xl">🎉</div>
      <h2 className="mt-2 text-2xl font-black text-pitch">You&apos;re in!</h2>
      <p className="mt-1 text-stone-500 dark:text-stone-300">
        Share this code so others can join:
      </p>
      <div className="my-3 inline-block rounded-2xl bg-cream px-6 py-3 text-3xl font-black tracking-[0.2em] text-grape dark:bg-stone-700 dark:text-violet-300">
        {state.groupCode}
      </div>
      {state.recoveryCode && (
        <div className="mt-3 rounded-2xl bg-sunburst/20 p-4 text-left dark:bg-sunburst/10">
          <p className="text-sm font-bold text-stone-700 dark:text-stone-100">
            🔑 Save your recovery code
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-300">
            You&apos;ll need it to get back into your account on another device.
          </p>
          <p className="mt-2 text-center text-xl font-black tracking-widest text-flame">
            {state.recoveryCode}
          </p>
        </div>
      )}
      <Link
        href={`/g/${state.groupCode}`}
        className="mt-5 inline-block rounded-full bg-pitch px-6 py-3 font-bold text-white shadow transition active:scale-95"
      >
        Go to the group →
      </Link>
    </div>
  );
}

function CreateForm() {
  const [state, action, pending] = useActionState(
    createGroupAction,
    INITIAL_JOIN_STATE,
  );
  if (state.status === "success") return <Success state={state} />;
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={label}>Your name</label>
        <input name="realName" className={input} placeholder="Zoher Kachwala" required />
      </div>
      <div>
        <label className={label}>Group name</label>
        <input name="groupName" className={input} placeholder="Kachwala Family Cup" required />
      </div>
      <div>
        <label className={label}>Your nickname in this group (optional)</label>
        <input name="displayName" className={input} placeholder="Dad" />
      </div>
      <div>
        <label className={label}>If someone joins late…</label>
        <select name="lateJoinPolicy" className={input} defaultValue="carry_over">
          <option value="carry_over">Count their earlier predictions</option>
          <option value="start_even">Everyone starts even from now</option>
        </select>
      </div>
      {state.status === "error" && (
        <p className="text-sm font-bold text-flame">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-pitch py-3.5 text-lg font-bold text-white shadow transition active:scale-95 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create group"}
      </button>
    </form>
  );
}

function JoinForm() {
  const [state, action, pending] = useActionState(
    joinGroupAction,
    INITIAL_JOIN_STATE,
  );
  if (state.status === "success") return <Success state={state} />;
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={label}>Your name</label>
        <input name="realName" className={input} placeholder="Zoher Kachwala" required />
      </div>
      <div>
        <label className={label}>Group code</label>
        <input
          name="groupCode"
          className={`${input} uppercase tracking-[0.2em]`}
          placeholder="FAM7X2"
          autoCapitalize="characters"
          required
        />
      </div>
      <div>
        <label className={label}>Your nickname in this group (optional)</label>
        <input name="displayName" className={input} placeholder="GoalMachine" />
      </div>
      {state.status === "error" && (
        <p className="text-sm font-bold text-flame">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-grape py-3.5 text-lg font-bold text-white shadow transition active:scale-95 disabled:opacity-50"
      >
        {pending ? "Joining…" : "Join group"}
      </button>
    </form>
  );
}

export default function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Link href="/" className="text-sm font-bold text-stone-400">
        ← Back
      </Link>
      <h1 className="mt-3 mb-6 bg-gradient-to-r from-flame to-grape bg-clip-text text-3xl font-black text-transparent">
        Join the fun
      </h1>
      <Tabs searchParams={searchParams} />
    </main>
  );
}

function Tabs({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const initial = use(searchParams).mode === "create" ? "create" : "join";
  const [tab, setTab] = useState<"join" | "create">(initial);
  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-full bg-stone-100 p-1 dark:bg-stone-700">
        {(["join", "create"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm font-bold capitalize transition ${
              tab === t
                ? "bg-white text-stone-800 shadow dark:bg-stone-900 dark:text-stone-100"
                : "text-stone-500 dark:text-stone-300"
            }`}
          >
            {t === "join" ? "Join a group" : "Create a group"}
          </button>
        ))}
      </div>
      {tab === "create" ? <CreateForm /> : <JoinForm />}
    </div>
  );
}
