import type { Metadata, Viewport } from "next";
import { Archivo_Black } from "next/font/google";
import Link from "next/link";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import { getAuthUser } from "@/lib/identity";
import { getProfile, initials } from "@/lib/profile";
import { appBaseUrl } from "@/lib/app-url";
import { AccountMenu } from "@/components/AccountMenu";
import { BottomNav } from "@/components/BottomNav";
import { GlassGlow } from "@/components/GlassGlow";
import { FOCUS_RING } from "@/components/theme";

/* Punchy display face for headlines and big score digits. Exposed as a CSS
   variable on <html>; globals.css maps it onto the `--font-display` theme token
   so the Tailwind `font-display` utility picks it up. Body text stays on the
   system stack. */
const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

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
    <html lang="en" className={archivoBlack.variable}>
      <body className="text-stone-100 antialiased">
        <GlassGlow />
        {/* Header aligns to the PageShell `wide` width token (max-w-5xl) so it
            no longer overhangs narrower pages — those centre inside it. */}
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-sm font-black tracking-tight text-emerald-400 ${FOCUS_RING}`}
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
        {/* Persistent mobile tab bar (md:hidden); coexists with the predict save
            bar, which floats just above it. */}
        <BottomNav loggedIn={Boolean(user)} userId={user?.id ?? null} />
      </body>
    </html>
  );
}
