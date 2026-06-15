"use client";

import { useState } from "react";
import { FOCUS_RING } from "./theme";

/**
 * Shares a rendered share **image** (a PNG served by one of the /s/… /og
 * endpoints) via the Web Share API, so it lands as a picture in
 * WhatsApp/iMessage/Photos/Stories. The caption carries the link too, since a
 * shared image has no link of its own. Where file sharing isn't available (e.g.
 * Brave on Android, or desktop), it falls back to sharing — then copying — the
 * link, which still unfurls into the same image via the page's OG metadata.
 *
 * `url` and `imagePath` are origin-relative paths; the absolute URL is built
 * from the current origin at click time.
 */
export function ShareButton({
  url,
  imagePath,
  title,
  caption,
  fileName,
  idleLabel = "📸 Share",
  ariaLabel,
}: {
  /** The shareable page path, e.g. `/s/ABCD`. */
  url: string;
  /** The PNG endpoint path, e.g. `/s/ABCD/og`. */
  imagePath: string;
  title: string;
  /** Short text shared alongside the image/link. */
  caption: string;
  /** Downloaded file name for the shared image. */
  fileName: string;
  idleLabel?: string;
  ariaLabel?: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  }

  async function share() {
    const absUrl = `${window.location.origin}${url}`;

    // 1) Try to share the image file itself. The caption carries the link too,
    //    since a shared image has no link of its own.
    let file: File | null = null;
    try {
      setBusy(true);
      const res = await fetch(imagePath);
      if (res.ok) {
        const blob = await res.blob();
        file = new File([blob], fileName, { type: "image/png" });
      }
    } catch {
      // network/render hiccup — we'll fall back to the link below
    } finally {
      setBusy(false);
    }

    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title, text: `${caption}\n${absUrl}` });
        flash("Shared ✓");
        return;
      } catch (e) {
        // Dismissing the sheet isn't an error; anything else falls through to
        // sharing the link instead.
        if ((e as Error)?.name === "AbortError") return;
      }
    }

    // 2) Fall back to sharing/copying the link (still unfurls into the image, so
    //    the caption omits the URL here).
    try {
      if (navigator.share) {
        await navigator.share({ url: absUrl, title, text: caption });
        flash("Shared ✓");
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(absUrl);
      flash("Link copied ✓");
    } catch {
      flash("Couldn't share");
    }
  }

  return (
    <button
      onClick={share}
      disabled={busy}
      aria-label={ariaLabel ?? title}
      className={`rounded-full chrome px-4 py-2 text-sm font-bold text-violet-300 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${FOCUS_RING}`}
    >
      {busy ? "Preparing…" : (msg ?? idleLabel)}
    </button>
  );
}
