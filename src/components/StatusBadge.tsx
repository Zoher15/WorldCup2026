import { LIVE_TEXT, RESULT_TEXT } from "./theme";

/** The live treatment shared by the match card's status pill and the group
 *  page's match rows: pulsing dot + flame content (LIVE/minute, or the score).
 *  `className` carries each spot's extra styling (e.g. the card's glass pill). */
export function LiveBadge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${LIVE_TEXT}${className ? ` ${className}` : ""}`}
    >
      <span className="live-dot h-2 w-2 rounded-full bg-flame" />
      {children}
    </span>
  );
}

/** The full-time treatment (result-coloured text), shared the same way. */
export function FullTimeBadge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`${RESULT_TEXT}${className ? ` ${className}` : ""}`}>
      {children}
    </span>
  );
}
