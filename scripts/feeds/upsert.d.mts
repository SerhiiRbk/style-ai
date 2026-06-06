import type { CanonicalProduct } from "./run.d.mts";

export function getSupabase(): unknown;

export type SourceType = "feed" | "scraper" | "seed" | "manual";

export function embedAndUpsert(
  products: CanonicalProduct[],
  opts?: {
    model?: string;
    batchSize?: number;
    onProgress?: (done: number, total: number) => void;
    sourceType?: SourceType;
  },
): Promise<number>;
