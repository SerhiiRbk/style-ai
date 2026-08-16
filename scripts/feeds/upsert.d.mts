import type { CanonicalProduct } from "./run.d.mts";

export function getSupabase(): unknown;

export type SourceType = "feed" | "scraper" | "seed" | "manual";

export function toRow(
  p: CanonicalProduct,
  embedding: number[] | undefined,
  sourceType: SourceType | undefined,
  unhide: boolean | undefined,
): Record<string, unknown>;

export function offerRow(
  productId: string,
  p: CanonicalProduct,
  sourceType: SourceType | undefined,
): Record<string, unknown>;

export function embedAndUpsert(
  products: CanonicalProduct[],
  opts?: {
    model?: string;
    batchSize?: number;
    onProgress?: (done: number, total: number) => void;
    sourceType?: SourceType;
    unhide?: boolean;
  },
): Promise<number>;
