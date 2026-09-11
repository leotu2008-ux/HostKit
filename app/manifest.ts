import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HostKit",
    short_name: "HostKit",
    description: "Plan a night, register, and get people through the door.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f8f7",
    theme_color: "#f8f8f7",
    icons: [
      // Raster first. iOS ignores SVG and manifest icons entirely and takes
      // the PNG apple-touch-icon (app/apple-icon.png) instead; Android's
      // install banner wants a 192 and a 512. The H mark is generated from
      // public/brand/HostKit_Logo.png and has enough margin to survive a
      // maskable crop.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
