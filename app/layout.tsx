import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { AppFrame } from "@/components/app-frame";
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
  themeColor: "#fbf8f4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full`}
    >
      <body className="min-h-full bg-sunk">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
