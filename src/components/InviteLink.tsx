"use client";

import { useState } from "react";
import { FOCUS_RING } from "./theme";

/** "Copy invite link" button: copies a shareable /i/<code> URL to the clipboard. */
export function InviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const url = `${window.location.origin}/i/${code}`;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
    } else {
      done();
    }
  }

  return (
    <button
      onClick={copy}
      aria-label="Copy invite link to clipboard"
      className={`rounded-full glass px-4 py-2 text-sm font-bold text-grape transition active:scale-95 dark:text-violet-300 ${FOCUS_RING}`}
    >
      {copied ? "Link copied ✓" : "🔗 Copy invite link"}
    </button>
  );
}
