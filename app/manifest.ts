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
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
