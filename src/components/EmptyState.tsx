import Link from "next/link";
import { FOCUS_RING } from "./theme";

/** Friendly "nothing here yet" notice: big emoji, headline, hint, one CTA.
 *  Standalone states get their own glass panel; pass `framed={false}` (and a
 *  deeper `heading`) when it sits inside a panel that already has an h2. */
export function EmptyState({
  icon,
  title,
  hint,
  href,
  cta,
  framed = true,
  heading: Heading = "h2",
}: {
  icon: string;
  title: string;
  hint: string;
  href: string;
  cta: string;
  framed?: boolean;
  heading?: "h2" | "h3";
}) {
  return (
    <div className={framed ? "rounded-2xl glass p-6 text-center" : "text-center"}>
      <div className="float-bob mb-2 text-4xl">{icon}</div>
      <Heading className="text-lg font-black text-stone-700 dark:text-stone-100">
        {title}
      </Heading>
      <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-300">
        {hint}
      </p>
      <Link
        href={href}
        className={`mt-4 inline-block rounded-full chrome px-6 py-3 font-bold text-pitch transition active:scale-95 dark:text-emerald-400 ${FOCUS_RING}`}
      >
        {cta}
      </Link>
    </div>
  );
}
