import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

/** Public, indexable routes. Private/owner-only paths are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl().origin;
  const now = new Date();
  const entries: { path: string; priority: number; freq: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/pricing", priority: 0.8, freq: "monthly" },
    { path: "/catalog", priority: 0.7, freq: "weekly" },
    { path: "/report/demo", priority: 0.6, freq: "monthly" },
    { path: "/start", priority: 0.6, freq: "monthly" },
  ];
  return entries.map((e) => ({
    url: `${base}${e.path}`,
    lastModified: now,
    changeFrequency: e.freq,
    priority: e.priority,
  }));
}
