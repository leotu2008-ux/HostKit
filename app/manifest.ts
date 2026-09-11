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
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
