export function mapCategory(rawCategory: unknown, title?: string): string;
export function toEur(
  price: number,
  currency: string,
  ratesEnv?: Record<string, number>,
): number;
export function parsePrice(raw: unknown): number;
export function parseBool(raw: unknown): boolean | undefined;
export function inferMarket(currency: unknown): "EU" | "US";
export function inferGender(
  ...values: unknown[]
): "men" | "women" | "unisex" | "kids" | undefined;
export function embedText(p: Record<string, unknown>): string;
export function colorKey(color?: unknown, colorHex?: unknown): string;
export function productVariantKey(p: {
  source: string;
  externalId?: string;
  external_id?: string;
  color?: string;
  colorHex?: string;
  color_key?: string;
}): string;
export function dedupeProducts<
  T extends { source: string; externalId: string; color?: string; colorHex?: string },
>(
  products: T[],
): { products: T[]; duplicatesRemoved: number };
