import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the pg driver out of the serverless bundle so Prisma's adapter
  // loads the real package at runtime on Vercel.
  serverExternalPackages: ["pg"],
  // Not currently set: `cacheComponents: true`. Enabling it breaks the
  // `html:has(.theme-app)` marker; see its comment in app/globals.css.
  // `next dev` only serves its script chunks to the hostname it started on
  // (localhost). Opened as 127.0.0.1, or from a phone on the same Wi-Fi,
  // the page loads its HTML but never its JavaScript: nothing hydrates, the
  // account menu won't open, and the launch splash never finishes. These
  // are the origins a laptop and a phone on a home network use.
  allowedDevOrigins: ["127.0.0.1", "*.local", "192.168.*.*", "10.*.*.*", "172.*.*.*"],
  images: {
    // Uploaded photos live in Vercel Blob (lib/images.ts); the local
    // fallback serves them from /api/images, which is same-origin.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Nothing here belongs in someone else's frame (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
