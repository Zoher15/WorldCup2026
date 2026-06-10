import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import { getAuthUser } from "@/lib/identity";
import { getProfile, initials } from "@/lib/profile";
import { appBaseUrl } from "@/lib/app-url";
import { AccountMenu } from "@/components/AccountMenu";
import { GlassGlow } from "@/components/GlassGlow";

export const metadata: Metadata = {
  // Absolute base for OG/Twitter image URLs — without this Next emits a
  // localhost URL that link-preview crawlers (WhatsApp, iMessage…) can't fetch,
  // so the leaderboard share image never shows.
  metadataBase: new URL(appBaseUrl()),
  title: "World Cup 2026 Predictions",
  description:
    "Predict scorelines and winners, compete with family and friends.",
};

export const viewport: Viewport = {
  themeColor: "#0b8a3e",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;
  const name = profile?.name ?? null;

  return (
    <html lang="en">
      <body className="text-stone-800 antialiased dark:text-stone-100">
        <GlassGlow />
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-sm font-black tracking-tight text-pitch dark:text-emerald-400"
          >
            ⚽ World Cup 2026
          </Link>
          <AccountMenu
            loggedIn={Boolean(user)}
            name={name}
            initials={name ? initials(name) : "🙂"}
          />
        </header>
        {children}
      </body>
    </html>
  );
}
