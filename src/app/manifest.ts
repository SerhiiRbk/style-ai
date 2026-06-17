import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/** Web app manifest — install metadata, theme colours, and icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.eyebrow}`,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#15120d",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/images/valetti-logo-512.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
