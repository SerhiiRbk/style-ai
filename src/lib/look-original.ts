import type { ShoppingItem } from "@/lib/report";

/** Carlo's look at first constructor Apply — used to restore the original. */
export type OriginalLookSnapshot = {
  title: string;
  description: string;
  palette: string[];
  imagePath: string;
  imagePathTq: string | null;
  items: ShoppingItem[];
  savedAt: string;
};

function asItems(raw: unknown): ShoppingItem[] {
  return Array.isArray(raw) ? (raw as ShoppingItem[]) : [];
}

function asPalette(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && Boolean(x));
}

export function parseOriginalLook(raw: unknown): OriginalLookSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const imagePath =
    (typeof o.imagePath === "string" && o.imagePath) ||
    (typeof o.image_path === "string" && o.image_path) ||
    "";
  if (!imagePath) return null;
  const tq = o.imagePathTq ?? o.image_path_tq;
  return {
    title: typeof o.title === "string" ? o.title : "Look",
    description: typeof o.description === "string" ? o.description : "",
    palette: asPalette(o.palette),
    imagePath,
    imagePathTq: typeof tq === "string" && tq ? tq : null,
    items: asItems(o.items),
    savedAt:
      typeof o.savedAt === "string" && o.savedAt
        ? o.savedAt
        : new Date().toISOString(),
  };
}

export function mergeOriginalLooks(
  ...maps: Record<number, OriginalLookSnapshot>[]
): Record<number, OriginalLookSnapshot> {
  const out: Record<number, OriginalLookSnapshot> = {};
  for (const map of maps) {
    for (const [idx, snap] of Object.entries(map)) {
      const n = Number(idx);
      if (out[n]) continue;
      out[n] = snap;
    }
  }
  return out;
}

export function parseOriginalLooks(
  raw: unknown,
): Record<number, OriginalLookSnapshot> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<number, OriginalLookSnapshot> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0) continue;
    const snap = parseOriginalLook(value);
    if (snap) out[idx] = snap;
  }
  return out;
}

export function originalLooksToJson(
  map: Record<number, OriginalLookSnapshot>,
): Record<string, OriginalLookSnapshot> {
  const out: Record<string, OriginalLookSnapshot> = {};
  for (const [idx, snap] of Object.entries(map)) out[idx] = snap;
  return out;
}

/** True when the live look no longer matches Carlo's stored original. */
export function lookDiffersFromOriginal(
  current: { imagePath?: string | null; description?: string | null },
  original: OriginalLookSnapshot | null | undefined,
): boolean {
  if (!original) return false;
  const image = current.imagePath ?? "";
  const description = current.description ?? "";
  return image !== original.imagePath || description !== original.description;
}
