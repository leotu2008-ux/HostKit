import type { Metadata, Viewport } from "next";
import { EB_Garamond, Inter } from "next/font/google";
import { AppFrame } from "@/components/app-frame";
import { LaunchSplash } from "@/components/launch-splash";
import { SPLASH_BOOTSTRAP } from "@/lib/splash";
import "./globals.css";

// One face everywhere — Inter — the same as the iOS app bundles.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// The hero's first line. Trajan Pro is named first in the stack; this is the
// classical serif from that lockup, which we can actually ship.
const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: "500",
});

const description =
  "For recurring event hosts. An agent drafts the plan, budget, run sheet, guest list and RSVPs, blasts, and door check-in, then runs the next night again.";

export const metadata: Metadata = {
  title: {
    default: "Hosty",
    template: "%s · Hosty",
  },
  description,
  openGraph: { description },
  twitter: { description },
  appleWebApp: {
    capable: true,
    title: "Hosty",
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
    // suppressHydrationWarning: the splash bootstrap stamps data-splash on
    // <html> before React runs, once per session.
    <html lang="en" className={`${inter.variable} ${garamond.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-paper">
        <script dangerouslySetInnerHTML={{ __html: SPLASH_BOOTSTRAP }} />
        {/* No scripts at all: nothing would ever mark the splash done. */}
        <noscript>
          <style>{`.launch-splash{display:none}`}</style>
        </noscript>
        <LaunchSplash />
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
