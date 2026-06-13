/** Copy shown while navigating to a route. */
export function navigationMessage(path: string | null): string {
  if (!path) return "One moment…";
  if (path.startsWith("/reports")) return "Gathering your reports…";
  if (path.startsWith("/report/")) return "Opening your style report…";
  if (path.startsWith("/start")) return "Preparing your atelier…";
  if (path.startsWith("/catalog")) return "Curating the collection…";
  if (path.startsWith("/pricing")) return "Loading pricing…";
  if (path.startsWith("/login")) return "One moment…";
  return "One moment…";
}

export const WORKING = {
  tryon: "Rendering the look on your photo…",
  outfit: "Rendering your outfit…",
  look: "Composing a new look on your photo…",
  regen: "Refining this preview…",
  report: "Crafting your report…",
  upload: "Uploading your photo…",
} as const;
