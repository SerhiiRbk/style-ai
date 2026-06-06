import type { ZodType } from "zod";

export const CATEGORIES: readonly string[];

export interface CanonicalProductInput {
  source: string;
  externalId: string;
  sku?: string;
  brand?: string;
  title: string;
  description?: string;
  category: string;
  gender?: "men" | "women" | "unisex" | "kids";
  color?: string;
  colorHex?: string;
  price: number;
  currency: string;
  priceEur: number;
  market?: "EU" | "US";
  imageUrl?: string;
  deeplink: string;
  inStock?: boolean;
  attrs?: Record<string, unknown>;
}

export const canonicalProductSchema: ZodType<CanonicalProductInput>;
