import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the pg driver out of the serverless bundle so Prisma's adapter
  // loads the real package at runtime on Vercel.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
