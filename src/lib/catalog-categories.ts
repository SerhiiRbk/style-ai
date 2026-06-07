/** Fixed catalogue categories — keep in sync with scripts/feeds/schema.mjs */
export const CATALOG_CATEGORIES = [
  "Outerwear",
  "Knitwear",
  "Shirts",
  "Trousers",
  "Footwear",
  "Accessories",
  "Bags",
  "Activewear",
  "Swimwear",
  "Underwear",
  "Grooming",
  "Dresses",
  "Suits",
  "Other",
] as const;

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

export function isCatalogCategory(v: string): v is CatalogCategory {
  return (CATALOG_CATEGORIES as readonly string[]).includes(v);
}
