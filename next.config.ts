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
};

export default nextConfig;
