import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Qurtiz AI",
    short_name: "Qurtiz",
    description: "Your AI social media workspace",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#11120f",
    theme_color: "#11120f",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
