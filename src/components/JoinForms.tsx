"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createGroupAction, joinGroupAction } from "@/app/actions";
import { INITIAL_JOIN_STATE, type JoinState } from "@/app/join-state";

const input =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base font-medium outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500";
const label = "mb-1 block text-sm font-bold text-stone-600 dark:text-stone-200";

function Success({ state }: { state: JoinState }) {
  return (
    <div className="animate-pop-in rounded-3xl glass p-6 text-center">
      <div className="text-4xl">🎉</div>
      <h2 className="mt-2 text-2xl font-black text-pitch dark:text-emerald-400">You&apos;re in!</h2>
      <p className="mt-1 text-stone-500 dark:text-stone-300">
        Share this code so others can join:
      </p>
      <div className="my-3 inline-block rounded-2xl bg-cream px-6 py-3 text-3xl font-black tracking-[0.2em] text-grape dark:bg-stone-700 dark:text-violet-300">
        {state.groupCode}
      </div>
      <Link
        href={`/g/${state.groupCode}`}
        className="mt-5 inline-block rounded-full bg-pitch px-6 py-3 font-bold text-white shadow transition active:scale-95"
      >
        Go to the group →
      </Link>
    </div>
  );
}

function CreateForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(
    createGroupAction,
    INITIAL_JOIN_STATE,
  );
  if (state.status === "success") return <Success state={state} />;
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={label}>Your name</label>
        <input
          name="realName"
          className={input}
          placeholder="Zoher Kachwala"
          defaultValue={defaultName}
          required
        />
      </div>
      <div>
        <label className={label}>Group name</label>
        <input
          name="groupName"
          className={input}
          placeholder="Kachwala Family Cup"
          required
        />
      </div>
      <div>
        <label className={label}>Your nickname in this group (optional)</label>
        <input name="displayName" className={input} placeholder="Dad" />
      </div>
      <div>
        <label className={label}>If someone joins late…</label>
        <select
          name="lateJoinPolicy"
          className={input}
          defaultValue="carry_over"
        >
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

function JoinForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(
    joinGroupAction,
    INITIAL_JOIN_STATE,
  );
  if (state.status === "success") return <Success state={state} />;
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={label}>Your name</label>
        <input
          name="realName"
          className={input}
          placeholder="Zoher Kachwala"
          defaultValue={defaultName}
          required
        />
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

export function JoinForms({
  initialTab,
  defaultName,
}: {
  initialTab: "join" | "create";
  defaultName: string;
}) {
  const [tab, setTab] = useState<"join" | "create">(initialTab);
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
      {tab === "create" ? (
        <CreateForm defaultName={defaultName} />
      ) : (
        <JoinForm defaultName={defaultName} />
      )}
    </div>
  );
}
