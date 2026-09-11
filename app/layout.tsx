import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppFrame } from "@/components/app-frame";
import "./globals.css";

// One face everywhere — Inter — the same as the iOS app bundles.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "HostKit",
    template: "%s · HostKit",
  },
  description:
    "Find a night, register in a tap, or plan your own — timeline, budget, and guest list in one place.",
  appleWebApp: {
    capable: true,
    title: "HostKit",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

// Light and dark come straight from the device (see globals.css), so the
// browser chrome follows the same media query.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0f" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-paper">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
