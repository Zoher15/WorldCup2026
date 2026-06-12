import Link from "next/link";

/**
 * A player's display name, linked to their in-group profile when there's a
 * group code to link into; rendered unlinked otherwise (no group context, or a
 * row — like the bot's on the per-match board — that shouldn't link anywhere).
 */
export function PlayerLink({
  userId,
  code,
  className,
  children,
}: {
  userId: string;
  /** Group code for the profile route; omit to render unlinked. */
  code?: string;
  /** Classes for the rendered element (the link also gains hover:underline). */
  className?: string;
  children: React.ReactNode;
}) {
  if (!code) {
    return className != null ? (
      <span className={className}>{children}</span>
    ) : (
      <>{children}</>
    );
  }
  return (
    <Link
      href={`/g/${code}/p/${userId}`}
      // Don't prefetch: a leaderboard renders one of these per player, and each
      // target is a force-dynamic profile page. Eagerly prefetching them all at
      // once floods the connection with RSC requests; on mobile one gets
      // cancelled mid-stream and the router throws "Connection closed". Profiles
      // are an occasional tap, so load them on click instead.
      prefetch={false}
      className={`${className ?? ""} hover:underline`}
    >
      {children}
    </Link>
  );
}
