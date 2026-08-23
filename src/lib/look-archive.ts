import type { ShoppingItem } from "@/lib/report";
import {
  parseLookEstimate,
  type StoredLookEstimate,
} from "@/lib/look-estimate";
import {
  parseOriginalLook,
  type OriginalLookSnapshot,
} from "@/lib/look-original";

export type ArchivedLookImage = {
  path: string;
  title: string;
  createdAt: string;
  /** When set, this archive row is Carlo's original for that look idx. */
  lookIndex?: number;
  description?: string;
  palette?: string[];
  items?: ShoppingItem[];
  /** Fallback when look_sets.construct_estimates is not on the DB yet. */
  constructEstimate?: StoredLookEstimate;
};

export function parseArchivedLookImages(raw: unknown): ArchivedLookImage[] {
  if (!Array.isArray(raw)) return [];
  const out: ArchivedLookImage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const path = rec.path;
    const title = rec.title;
    const createdAt = rec.createdAt;
    if (typeof path !== "string" || !path) continue;
    const lookIndex =
      typeof rec.lookIndex === "number" && Number.isInteger(rec.lookIndex)
        ? rec.lookIndex
        : undefined;
    const entry: ArchivedLookImage = {
      path,
      title: typeof title === "string" && title ? title : "Look",
      createdAt:
        typeof createdAt === "string" && createdAt
          ? createdAt
          : new Date().toISOString(),
    };
    if (lookIndex != null) entry.lookIndex = lookIndex;
    if (typeof rec.description === "string") entry.description = rec.description;
    if (Array.isArray(rec.palette)) {
      entry.palette = rec.palette.filter((x): x is string => typeof x === "string");
    }
    if (Array.isArray(rec.items)) entry.items = rec.items as ShoppingItem[];
    const estimate = parseLookEstimate(rec.constructEstimate);
    if (estimate) entry.constructEstimate = estimate;
    out.push(entry);
  }
  return out;
}

/** First archived snapshot per look index (constructor writes these once). */
export function originalsFromArchived(
  raw: unknown,
): Record<number, OriginalLookSnapshot> {
  const out: Record<number, OriginalLookSnapshot> = {};
  for (const img of parseArchivedLookImages(raw)) {
    if (img.lookIndex == null || img.lookIndex < 0) continue;
    if (out[img.lookIndex]) continue;
    const snap = parseOriginalLook({
      title: img.title,
      description: img.description ?? "",
      palette: img.palette ?? [],
      imagePath: img.path,
      items: img.items ?? [],
      savedAt: img.createdAt,
    });
    if (snap) out[img.lookIndex] = snap;
  }
  return out;
}

/** Estimates stashed on archive rows when the dedicated column is missing. */
export function estimatesFromArchived(
  raw: unknown,
): Record<number, StoredLookEstimate> {
  const out: Record<number, StoredLookEstimate> = {};
  for (const img of parseArchivedLookImages(raw)) {
    if (img.lookIndex == null || !img.constructEstimate) continue;
    if (!out[img.lookIndex]) out[img.lookIndex] = img.constructEstimate;
  }
  return out;
}
