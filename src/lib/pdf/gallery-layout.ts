/** Below this, a packed portrait is too small — start a new page instead. */
export const PACKED_GALLERY_MIN_IMAGE = 80;

/** How tall each packed gallery image can be so `rows` fit in `budget`. */
export function packedGalleryImageHeight(opts: {
  budget: number;
  rows: number;
  captionHeight: number;
  rowGap: number;
  captionGap?: number;
  naturalHeight: number;
}): number {
  const rows = Math.max(1, opts.rows);
  const captionGap = opts.captionGap ?? 8;
  const perRowChrome = captionGap + opts.captionHeight + opts.rowGap;
  const fitted = (opts.budget - rows * perRowChrome) / rows;
  return Math.max(48, Math.min(opts.naturalHeight, fitted));
}

/**
 * Packed image box. Height fits the page; width follows `ratio` (height/width)
 * so a 4:5 portrait is never stretched.
 */
export function packedGallerySize(opts: {
  budget: number;
  rows: number;
  captionHeight: number;
  rowGap: number;
  captionGap?: number;
  naturalHeight: number;
  ratio: number;
}): { width: number; height: number } {
  const height = packedGalleryImageHeight(opts);
  const ratio = Math.max(opts.ratio, 0.01);
  return { width: height / ratio, height };
}

/** True when shrinking the images still leaves a usable portrait on this page. */
export function packedGalleryFits(opts: {
  budget: number;
  rows: number;
  captionHeight: number;
  rowGap: number;
  captionGap?: number;
}): boolean {
  const fitted = packedGalleryImageHeight({
    ...opts,
    naturalHeight: Number.POSITIVE_INFINITY,
  });
  return fitted >= PACKED_GALLERY_MIN_IMAGE;
}

/** Items drawn on one packed page (a 2×2 of portraits is 4). */
export function packedGalleryPageSize(cols: number, rows: number): number {
  return Math.max(1, cols) * Math.max(1, rows);
}
