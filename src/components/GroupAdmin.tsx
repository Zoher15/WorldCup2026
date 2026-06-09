"use client";

import { useState, useTransition } from "react";
import { deleteGroupAction, removeMemberAction } from "@/app/g/[code]/actions";

interface Member {
  userId: string;
  displayName: string;
}

/**
 * Admin-only controls for a group: remove members and delete the whole group.
 * Rendered only when the viewer is the group's admin (checked server-side).
 */
export function GroupAdmin({
  code,
  members,
  creatorId,
}: {
  code: string;
  members: Member[];
  creatorId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full glass px-4 py-2 text-sm font-bold text-stone-600 transition active:scale-95 dark:text-stone-200"
      >
        {open ? "Done managing" : "⚙️ Manage group"}
      </button>

      {open && (
        <div className="mt-3 rounded-2xl glass p-4">
          <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-stone-400">
            Members
          </h3>
          <ul className="space-y-1">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
              >
                <span className="truncate text-sm font-bold text-stone-700 dark:text-stone-100">
                  {m.displayName}
                  {m.userId === creatorId && (
                    <span className="ml-1.5 text-xs font-bold text-stone-400">
                      admin
                    </span>
                  )}
                </span>
                {m.userId !== creatorId && (
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Remove ${m.displayName} from the group?`)) {
                        start(() => removeMemberAction(code, m.userId));
                      }
                    }}
                    className="rounded-full glass px-3 py-1 text-xs font-bold text-flame transition active:scale-95 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
            <button
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
              className="rounded-full glass px-4 py-2 text-sm font-bold text-flame transition active:scale-95 disabled:opacity-50"
            >
              Delete group
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
