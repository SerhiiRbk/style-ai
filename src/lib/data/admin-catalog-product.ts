import { isCatalogCategory } from "@/lib/catalog-categories";
import { inferMarket, toEur } from "../../../scripts/feeds/normalize.mjs";
import { normalizeTitle } from "../../../scripts/feeds/humanize.mjs";
import type { CanonicalProduct } from "../../../scripts/feeds/run.d.mts";

export const ADMIN_PRODUCT_SOURCE = "manual:admin";
export const ADMIN_GENDERS = ["men", "women", "unisex", "kids"] as const;

export type AdminProductParseOpts = {
  source?: string;
  externalId?: string;
};

export type AdminProductParseResult =
  | { ok: true; product: CanonicalProduct }
  | { ok: false; error: string };

function asTrimmed(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asOptional(v: unknown): string | null {
  const s = asTrimmed(v);
  return s ? s : null;
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseAdminProduct(
  body: unknown,
  opts: AdminProductParseOpts = {},
): AdminProductParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid product payload" };
  }
  const b = body as Record<string, unknown>;
  const rawTitle = asTrimmed(b.title);
  if (!rawTitle) return { ok: false, error: "Title is required" };

  const category = asTrimmed(b.category);
  if (!isCatalogCategory(category)) {
    return { ok: false, error: "Invalid category" };
  }

  const priceRaw = b.price;
  const price =
    typeof priceRaw === "number" ? priceRaw : Number.parseFloat(asTrimmed(priceRaw));
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "Price must be a non-negative number" };
  }

  const deeplink = asTrimmed(b.deeplink);
  if (!deeplink || !isHttpUrl(deeplink)) {
    return { ok: false, error: "A valid product URL (deeplink) is required" };
  }

  const imageUrl = asOptional(b.imageUrl ?? b.image_url);
  if (imageUrl && !isHttpUrl(imageUrl)) {
    return { ok: false, error: "Image URL is not valid" };
  }

  const gender = asOptional(b.gender);
  if (gender && !ADMIN_GENDERS.includes(gender as (typeof ADMIN_GENDERS)[number])) {
    return { ok: false, error: "Invalid gender" };
  }

  const currency = (asTrimmed(b.currency) || "EUR").toUpperCase();
  const { title, titleRaw } = normalizeTitle(rawTitle);
  const source = asTrimmed(opts.source) || ADMIN_PRODUCT_SOURCE;
  const externalId = asTrimmed(opts.externalId) || asTrimmed(b.externalId) || "";

  return {
    ok: true,
    product: {
      source,
      externalId,
      title,
      titleRaw,
      brand: asOptional(b.brand),
      category,
      color: asOptional(b.color),
      gender: gender ?? undefined,
      description: asOptional(b.description) ?? undefined,
      price,
      currency,
      priceEur: toEur(price, currency),
      market: inferMarket(currency),
      imageUrl: imageUrl ?? undefined,
      deeplink,
      inStock: true,
      sourceType: "manual",
    },
  };
}
