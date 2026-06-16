"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { FOCUS_RING } from "./theme";

/** "Invite friends" button. Shares a ready-written, occasion-aware caption via
 *  the native share sheet (WhatsApp/iMessage/…) when available — zero thought
 *  for the inviter — and falls back to copying the caption + link otherwise. */
export function InviteLink({
  code,
  groupName,
}: {
  code: string;
  /** Group name woven into the caption when known ("…join 'The Family Cup'"). */
  groupName?: string;
}) {
  const [copied, setCopied] = useState(false);

  function invite() {
    const url = `${window.location.origin}/i/${code}`;
    const where = groupName ? `“${groupName}”` : "my group";
    const text = `Think you know ball? ⚽ Predict every World Cup 2026 match with us — join ${where} (code ${code}):`;

    if (navigator.share) {
      navigator
        .share({ title: "World Cup 2026 Predictions", text, url })
        .catch(() => {
          /* user dismissed the share sheet — nothing to do */
        });
      return;
    }
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    const payload = `${text} ${url}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(payload).then(done).catch(done);
    } else {
      done();
    }
  }

  return (
    <button
      onClick={invite}
      aria-label="Invite friends to this group"
      className={`inline-flex items-center gap-1.5 rounded-full chrome px-4 py-2 text-sm font-bold text-violet-300 transition active:scale-95 ${FOCUS_RING}`}
    >
      {copied ? (
        "Invite copied ✓"
      ) : (
        <>
          <Icon name="link" /> Invite friends
        </>
      )}
    </button>
  );
}
