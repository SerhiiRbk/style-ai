import { z } from "zod";

/**
 * Canonical product format — the single contract every feed adapter and every
 * scraper must output. Add a new feed/scraper by mapping its raw rows into this
 * shape; nothing downstream (embeddings, dedup, DB) needs to change.
 */

export const CATEGORIES = [
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
];

export const canonicalProductSchema = z.object({
  // Identity / dedup
  source: z.string().min(1), // network:merchant, e.g. "awin:zalando"
  externalId: z.string().min(1), // parent SKU from the feed (colour = separate row)
  sku: z.string().optional(),
  ean: z.string().optional(), // EAN/GTIN — primary cross-country product identity
  mpn: z.string().optional(), // manufacturer part number — identity fallback
  country: z.string().optional(), // ISO-3166-1 alpha-2 offer country, or "" generic

  // Descriptive
  brand: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(CATEGORIES),
  gender: z.enum(["men", "women", "unisex", "kids"]).optional(),
  color: z.string().optional(), // human colour name
  colorHex: z.string().optional(), // optional swatch

  // Commercial
  price: z.number().nonnegative(),
  currency: z.string().default("EUR"),
  priceEur: z.number().nonnegative(), // normalized for matching/budget filters
  market: z.enum(["EU", "US"]).optional(), // availability region for filtering

  // Links / media
  imageUrl: z.string().url().optional(),
  deeplink: z.string().url(), // affiliate / tracking link

  // Misc
  inStock: z.boolean().optional(),
  attrs: z.record(z.string(), z.any()).optional(),
});

/** @typedef {z.infer<typeof canonicalProductSchema>} CanonicalProduct */
