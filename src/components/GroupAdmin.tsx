"use client";

import { useState, useTransition } from "react";
import {
  deleteGroupAction,
  removeMemberAction,
  renameGroupAction,
} from "@/app/g/[code]/actions";
import { Button } from "./Button";
import { inputClasses } from "./form-styles";

interface Member {
  userId: string;
  displayName: string;
}

/**
 * Admin-only controls for a group: rename it, remove members, and delete the
 * whole group. Rendered only when the viewer is the group's admin (checked
 * server-side).
 */
export function GroupAdmin({
  code,
  name,
  members,
  creatorId,
}: {
  code: string;
  name: string;
  members: Member[];
  creatorId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [nameDraft, setNameDraft] = useState(name);
  const [renameMsg, setRenameMsg] = useState<string | null>(null);

  function rename() {
    setRenameMsg(null);
    start(async () => {
      const res = await renameGroupAction(code, nameDraft);
      setRenameMsg(res.ok ? "Renamed ✓" : res.error ?? "Rename didn't take — give it another go.");
    });
  }

  const trimmed = nameDraft.trim();
  const renameDisabled = pending || !trimmed || trimmed === name;

  return (
    <div className="mt-6">
      <Button tone="muted" size="md" onClick={() => setOpen((o) => !o)}>
        {open ? "Done managing" : "⚙️ Manage group"}
      </Button>

      {open && (
        <div className="mt-3 rounded-2xl glass p-4">
          <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-stone-400">
            Group name
          </h3>
          <div className="flex items-center gap-2">
            <input
              value={nameDraft}
              onChange={(e) => {
                setNameDraft(e.target.value);
                setRenameMsg(null);
              }}
              maxLength={80}
              className={inputClasses}
            />
            <Button
              tone="pitch"
              size="md"
              onClick={rename}
              disabled={renameDisabled}
              className="shrink-0 py-3 disabled:opacity-40"
            >
              Rename
            </Button>
          </div>
          {renameMsg && (
            <p className="mt-1.5 text-xs font-bold text-stone-300">
              {renameMsg}
            </p>
          )}

          <h3 className="mb-2 mt-4 text-sm font-black uppercase tracking-wide text-stone-400">
            Members
          </h3>
          <ul className="space-y-1">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
              >
                <span className="truncate text-sm font-bold text-stone-100">
                  {m.displayName}
                  {m.userId === creatorId && (
                    <span className="ml-1.5 text-xs font-bold text-stone-400">
                      admin
                    </span>
                  )}
                </span>
                {m.userId !== creatorId && (
                  <Button
                    tone="flame"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Remove ${m.displayName} from the group?`)) {
                        start(() => removeMemberAction(code, m.userId));
                      }
                    }}
                    className="px-3 py-1 text-xs"
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 border-white/10 pt-3">
            <Button
              tone="flame"
              size="md"
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    "Delete this group for everyone? This can't be undone.",
                  )
                ) {
                  start(() => deleteGroupAction(code));
                }
              }}
            >
              Delete group
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
