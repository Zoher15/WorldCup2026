"use client";

import { useTransition } from "react";
import { leaveGroupAction } from "@/app/g/[code]/actions";

/**
 * "Leave group" control for ordinary members. The creator can't leave (they
 * delete the group instead), so this is only rendered for non-creators.
 */
export function LeaveGroup({ code, name }: { code: string; name: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm(`Leave “${name}”? You'll lose your spot on the board.`)) {
          start(() => leaveGroupAction(code));
        }
      }}
      className="rounded-full glass px-4 py-2 text-sm font-bold text-flame transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Leave group
    </button>
  );
}
