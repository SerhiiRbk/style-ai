import type { ShoppingItem } from "@/lib/report";

export type LookEstimateVerdict = "great" | "good" | "caution";

/** Carlo's read of a constructor-built look. Same shape as a try-on verdict. */
export type LookEstimateOpinion = {
  verdict: LookEstimateVerdict;
  headline: string;
  body: string;
  pairWith: string[];
};

export type StoredLookEstimate = {
  opinion: LookEstimateOpinion;
  /** Description + shop keys — stale after the next Apply or swap. */
  fingerprint: string;
  savedAt: string;
};

export const LOOK_ESTIMATE_VERDICT: Record<
  LookEstimateVerdict,
  { dot: string; label: string }
> = {
  great: { dot: "bg-emerald-500", label: "Strong match" },
  good: { dot: "bg-brass", label: "Works for you" },
  caution: { dot: "bg-amber-500", label: "Wearable, with a caveat" },
};

function itemKey(item: Pick<ShoppingItem, "productId" | "category" | "title">): string {
  return item.productId?.trim() || `${item.category}:${item.title}`;
}

/** Cache key so a rebuilt brief or swapped SKU does not reuse the old read. */
export function lookEstimateFingerprint(
  description: string,
  items: Pick<ShoppingItem, "productId" | "category" | "title">[],
): string {
  const keys = items.map(itemKey).join("|");
  return `${description.trim()}\n${keys}`;
}

export function estimateMatchesLook(
  stored: StoredLookEstimate | null | undefined,
  fingerprint: string,
): boolean {
  return Boolean(stored?.fingerprint && stored.fingerprint === fingerprint);
}

function parseOpinion(raw: unknown): LookEstimateOpinion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.verdict !== "great" && o.verdict !== "good" && o.verdict !== "caution") {
    return null;
  }
  if (typeof o.headline !== "string" || !o.headline.trim()) return null;
  if (typeof o.body !== "string" || !o.body.trim()) return null;
  const pairWith = Array.isArray(o.pairWith)
    ? o.pairWith.filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
    : [];
  return {
    verdict: o.verdict,
    headline: o.headline.trim(),
    body: o.body.trim(),
    pairWith,
  };
}

export function parseLookEstimate(raw: unknown): StoredLookEstimate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const opinion = parseOpinion(o.opinion);
  if (!opinion) return null;
  return {
    opinion,
    fingerprint: typeof o.fingerprint === "string" ? o.fingerprint : "",
    savedAt:
      typeof o.savedAt === "string" && o.savedAt
        ? o.savedAt
        : new Date().toISOString(),
  };
}

export function parseLookEstimates(
  raw: unknown,
): Record<number, StoredLookEstimate> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<number, StoredLookEstimate> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0) continue;
    const stored = parseLookEstimate(value);
    if (stored) out[idx] = stored;
  }
  return out;
}

export function lookEstimatesToJson(
  map: Record<number, StoredLookEstimate>,
): Record<string, StoredLookEstimate> {
  const out: Record<string, StoredLookEstimate> = {};
  for (const [idx, stored] of Object.entries(map)) out[idx] = stored;
  return out;
}
