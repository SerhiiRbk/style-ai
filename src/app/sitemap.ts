import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { COLOURS_ENABLED } from "@/lib/colours-feature";
import { SUBSEASON_LABELS } from "@/lib/style-profile";

/** Public, indexable routes. Private/owner-only paths are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl().origin;
  const now = new Date();
  // Only publicly reachable, indexable URLs. `/start` is auth-gated (redirects
  // to /login) and `/report/demo` is a redirect to the canonical slug below —
  // both are intentionally excluded.
  const entries: { path: string; priority: number; freq: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/pricing", priority: 0.8, freq: "monthly" },
    { path: "/catalog", priority: 0.7, freq: "weekly" },
    { path: "/shop-a-look", priority: 0.7, freq: "weekly" },
    { path: "/how-it-works", priority: 0.7, freq: "monthly" },
    { path: "/report/valetti-style-prospect-demo", priority: 0.6, freq: "monthly" },
    { path: "/privacy", priority: 0.4, freq: "monthly" },
    { path: "/terms", priority: 0.4, freq: "monthly" },
  ];

  // Free colour analysis + the 12 shareable subseason palettes. Only listed
  // when the feature is live — while paused these routes 404 (see A2 / A0).
  if (COLOURS_ENABLED) {
    entries.push({ path: "/colours", priority: 0.7, freq: "weekly" });
    for (const sub of Object.keys(SUBSEASON_LABELS)) {
      entries.push({ path: `/colours/${sub}`, priority: 0.5, freq: "monthly" });
    }
  }

  return entries.map((e) => ({
    url: `${base}${e.path}`,
    lastModified: now,
    changeFrequency: e.freq,
    priority: e.priority,
  }));
}
