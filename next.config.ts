import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the pg driver out of the serverless bundle so Prisma's adapter
  // loads the real package at runtime on Vercel.
  serverExternalPackages: ["pg"],
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
};

export default nextConfig;
