import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppFrame } from "@/components/app-frame";
import { LaunchSplash } from "@/components/launch-splash";
import { SPLASH_BOOTSTRAP } from "@/lib/splash";
import "./globals.css";

// One face everywhere — Inter — the same as the iOS app bundles.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Student Events",
    template: "%s · Student Events",
  },
  description:
    "Sell tickets to your event, share the link, and scan people in at the door.",
  appleWebApp: {
    capable: true,
    title: "Student Events",
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
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
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
