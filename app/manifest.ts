import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HostKit",
    short_name: "HostKit",
    description: "Plan a night, register, and get people through the door.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8f4",
    theme_color: "#fbf8f4",
    icons: [
      // Raster first. iOS ignores SVG and manifest icons entirely and takes
      // the PNG apple-touch-icon (app/apple-icon.png) instead; Android's
      // install banner wants a 192 and a 512. The H mark is generated from
      // public/brand/HostKit_Logo.png and has enough margin to survive a
      // maskable crop. The SVG stays for browsers that prefer a vector
      // favicon.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
