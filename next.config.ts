import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the pg driver out of the serverless bundle so Prisma's adapter
  // loads the real package at runtime on Vercel.
  serverExternalPackages: ["pg"],
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
