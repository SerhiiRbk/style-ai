import { createHash } from "crypto";
import { LOOK_RERANK_VERSION } from "@/lib/look-match-version";

export type RerankCacheSlot = {
  slot: number;
  candidateIds: string[];
};

export type RerankCacheInput = {
  lookTitle: string;
  lookDescription: string;
  paletteHints: string;
  styleId?: string | null;
  occasionId?: string | null;
  slots: RerankCacheSlot[];
  /** Override for tests — production keys use LOOK_RERANK_VERSION. */
  rerankVersion?: number;
};

export type RerankCacheStore<T> = {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
};

/**
 * Hash of the rerank prompt version + look copy + ordered top-8 ids.
 * A heuristic-only ranking bump that leaves those ids in the same order
 * reuses the cached Sonnet picks.
 */
export function rerankCacheKey(input: RerankCacheInput): string {
  const version = input.rerankVersion ?? LOOK_RERANK_VERSION;
  const body = [
    `v${version}`,
    input.lookTitle.trim(),
    input.lookDescription.trim(),
    input.paletteHints.trim(),
    input.styleId ?? "",
    input.occasionId ?? "",
    ...input.slots.map((s) => `${s.slot}:${s.candidateIds.join(",")}`),
  ].join("\n");
  return createHash("sha256").update(body).digest("hex").slice(0, 32);
}

export function memoryRerankStore<T>(limit = 200): RerankCacheStore<T> {
  const map = new Map<string, T>();
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      if (map.size > limit) {
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
    },
  };
}

export async function loadOrComputeRerank<T>(
  key: string,
  compute: () => Promise<T | null>,
  store: RerankCacheStore<T>,
): Promise<T | null> {
  const cached = await store.get(key);
  if (cached != null) return cached;
  const value = await compute();
  if (value != null) await store.set(key, value);
  return value;
}
