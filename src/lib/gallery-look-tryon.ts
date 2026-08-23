const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LOOK_TRYON_RE = new RegExp(
  `(?:^|/)tryon/look-(${UUID})-([a-z0-9-]+)\\.[a-z]+$`,
  "i",
);

export type LookTryonRef = {
  /** Report id or look-set id used as the storage namespace. */
  storageId: string;
  /** e.g. look-1 / capsule-0 */
  lookKey: string;
};

/** Parse `/tryon/look-{setOrReportId}-{lookKey}.jpg` from a try-on storage path. */
export function parseLookTryonPath(path: string): LookTryonRef | null {
  const m = path.match(LOOK_TRYON_RE);
  if (!m) return null;
  return { storageId: m[1]!.toLowerCase(), lookKey: m[2]! };
}

export function lookTryonLabel(
  lookKey: string,
  titles?: { idx: number; title: string | null }[],
): string {
  const lookMatch = lookKey.match(/^look-(\d+)$/i);
  if (lookMatch) {
    const idx = Number(lookMatch[1]);
    const titled = titles?.find((t) => t.idx === idx)?.title?.trim();
    return titled ? `Try-on · ${titled}` : `Try-on · look ${idx + 1}`;
  }
  if (/^capsule-/i.test(lookKey)) return "Try-on · capsule";
  return "Try-on";
}
