import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { Fraunces, Inter } from "next/font/google";
import { AppFrame } from "@/components/app-frame";
import { parsePreference, THEME_BOOTSTRAP, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const pref = parsePreference(
    (await cookies()).get(THEME_COOKIE)?.value,
  );

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full`}
      data-theme={pref === "system" ? undefined : pref}
      data-theme-pref={pref}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-paper">
        <Script id="hostkit-theme" strategy="beforeInteractive">
          {THEME_BOOTSTRAP}
        </Script>
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
