"use client";

import { useTransition } from "react";
import { leaveGroupAction } from "@/app/g/[code]/actions";
import { Button } from "./Button";

/**
 * "Leave group" control for ordinary members. The creator can't leave (they
 * delete the group instead), so this is only rendered for non-creators.
 */
export function LeaveGroup({ code, name }: { code: string; name: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      tone="flame"
      size="md"
      disabled={pending}
      onClick={() => {
        if (confirm(`Leave “${name}”? You'll lose your spot on the board.`)) {
          start(() => leaveGroupAction(code));
        }
      }}
    >
      Leave group
    </Button>
  );
}
