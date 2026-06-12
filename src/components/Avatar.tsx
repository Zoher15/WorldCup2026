/**
 * Round identity avatar: the player's initials over a gradient that's picked
 * deterministically from their userId, so the same player wears the same
 * colours on every board, row and profile. No hooks — renders the same on
 * server and client.
 */

import { BORINGBOT_ID } from "@/lib/standings";

/**
 * Hand-tuned two-colour gradient pairs — eight distinct hue families that all
 * read vividly over the dark glass surfaces. Tailwind v4 scans source for
 * class names, so these MUST stay complete static strings.
 */
const GRADIENTS = [
  "bg-gradient-to-br from-amber-300 to-orange-600",
  "bg-gradient-to-br from-rose-400 to-red-600",
  "bg-gradient-to-br from-fuchsia-400 to-pink-600",
  "bg-gradient-to-br from-violet-400 to-purple-700",
  "bg-gradient-to-br from-sky-400 to-blue-600",
  "bg-gradient-to-br from-cyan-300 to-teal-600",
  "bg-gradient-to-br from-emerald-400 to-green-600",
  "bg-gradient-to-br from-lime-300 to-yellow-500",
] as const;

/** BoringBot's avatar: the 🤖 on neutral stone — the baseline, not a player. */
const BOT_GRADIENT = "bg-gradient-to-br from-stone-500 to-stone-700";

const SIZES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
} as const;

/** djb2-style string hash — stable across server and client renders. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 1–2 initials from a display name. Non-letters (emoji, punctuation) are
 * stripped first so "BoringBot 🤖" yields "B", not a broken glyph; a name with
 * nothing usable falls back to "?".
 */
function initials(displayName: string): string {
  const words = displayName
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  // Spread to code points so a non-BMP first letter never splits mid-pair.
  const first = [...words[0]];
  if (words.length === 1) return first.slice(0, 2).join("").toUpperCase();
  return (first[0] + [...words[1]][0]).toUpperCase();
}

export function Avatar({
  userId,
  displayName,
  size = "sm",
  className,
}: {
  userId: string;
  displayName: string;
  /** sm for board rows, md for the podium and profile header. */
  size?: "sm" | "md";
  className?: string;
}) {
  const isBot = userId === BORINGBOT_ID;
  const gradient = isBot
    ? BOT_GRADIENT
    : GRADIENTS[hash(userId) % GRADIENTS.length];
  return (
    <span
      // Purely decorative — the player's name always renders beside it.
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-black text-white ring-1 ring-white/25 ${SIZES[size]} ${gradient}${className ? ` ${className}` : ""}`}
    >
      {isBot ? "🤖" : initials(displayName)}
    </span>
  );
}
