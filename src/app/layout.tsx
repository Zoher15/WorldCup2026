import type { Metadata, Viewport } from "next";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup 2026 Predictions",
  description:
    "Predict scorelines and winners, compete with family and friends.",
};

export const viewport: Viewport = {
  themeColor: "#0b8a3e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-stone-800 antialiased">{children}</body>
    </html>
  );
}
