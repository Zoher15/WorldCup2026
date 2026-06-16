"use client";

import { useActionState, useState } from "react";
import { createGroupAction, joinGroupAction } from "@/app/actions";
import { INITIAL_JOIN_STATE, type JoinState } from "@/app/join-state";
import { Button } from "./Button";
import { inputClasses as input, labelClasses as label } from "./form-styles";
import { FOCUS_RING } from "./theme";

const TABS = [
  { key: "join", label: "Join a group" },
  { key: "create", label: "Create a group" },
] as const;

function Success({ state }: { state: JoinState }) {
  return (
    <div className="animate-pop-in rounded-3xl glass p-6 text-center">
      <div className="text-4xl">🎉</div>
      <h2 className="mt-2 text-2xl font-black text-emerald-400">You&apos;re in!</h2>
      <p className="mt-1 text-stone-300">
        Share this code so others can join:
      </p>
      <div className="my-3 inline-block rounded-2xl glass px-6 py-3 text-3xl font-black tracking-[0.2em] text-violet-300">
        {state.groupCode}
      </div>
      <Button
        as="link"
        href={`/g/${state.groupCode}`}
        tone="pitch"
        size="lg"
        className="mt-5 inline-block"
      >
        Go to the group →
      </Button>
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
      <Button
        type="submit"
        tone="pitch"
        size="lg"
        disabled={pending}
        className="w-full py-3.5 text-lg"
      >
        {pending ? "Creating…" : "Create group"}
      </Button>
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
      <Button
        type="submit"
        tone="grape"
        size="lg"
        disabled={pending}
        className="w-full py-3.5 text-lg"
      >
        {pending ? "Joining…" : "Join group"}
      </Button>
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
      {/* Tabs match the Leaderboard's chrome tabs: the active tab is a solid
          chrome pill, inactive tabs are muted text that brightens on hover. */}
      <div className="mb-6 flex gap-1 rounded-full glass p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full py-2 text-sm font-bold capitalize transition ${FOCUS_RING} ${
              tab === t.key
                ? "chrome text-violet-300"
                : "text-stone-300 hover:text-white"
            }`}
          >
            {t.label}
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
