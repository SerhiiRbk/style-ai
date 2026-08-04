/**
 * Vertical share-asset formats (A4). The horizontal 1200×630 card stays the
 * default for link previews (og:image); these are the extra downloadable
 * compositions for the vertical channels §6 relies on.
 *
 * - `story` 9:16 1080×1920 — Stories, Reels, TikTok, Shorts. 1080×1920 is the
 *   native upload resolution: larger gets downscaled, smaller gets stretched.
 * - `pin` 2:3 1000×1500 — Pinterest, where a 9:16 pin is cropped and demoted.
 */
export type VerticalFormat = "story" | "pin";

export const VERTICAL_SIZE: Record<
  VerticalFormat,
  { width: number; height: number }
> = {
  story: { width: 1080, height: 1920 },
  pin: { width: 1000, height: 1500 },
};

export function parseVerticalFormat(
  value: string | null | undefined,
): VerticalFormat | null {
  return value === "story" || value === "pin" ? value : null;
}
