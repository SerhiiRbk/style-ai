import {
  mapCategory,
  toEur,
  parsePrice,
  parseBool,
  inferGender,
  inferMarket,
  inferCountry,
} from "./normalize.mjs";

function pick(record, keys) {
  for (const k of [].concat(keys ?? [])) {
    const v = record[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

// Common column names so feeds don't all need explicit map entries.
const EAN_KEYS = ["ean", "gtin", "g:gtin", "gtin13", "GTIN", "EAN", "barcode", "upc", "UPC"];
const MPN_KEYS = ["mpn", "g:mpn", "MPN", "manufacturer_part_number", "part_number"];
const COUNTRY_KEYS = ["country", "country_code", "market_country", "g:shipping_country", "Country"];

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Map raw feed records → canonical products using a source config. */
export function toCanonical(records, source, { fxRates } = {}) {
  const m = source.map;
  const out = [];

  for (const r of records) {
    const title = pick(r, m.title);
    const deeplink = pick(r, m.deeplink);
    if (!title || !deeplink) continue; // incomplete row — skip

    const rawCategory = pick(r, m.category);
    const brand = pick(r, m.brand);
    const color = pick(r, m.color);
    const price = parsePrice(pick(r, m.price));
    const currency = (pick(r, m.currency) || source.defaultCurrency || "EUR")
      .toString()
      .toUpperCase();
    const merchant = source.merchantField
      ? pick(r, source.merchantField)
      : undefined;

    const merchantSlug = merchant ? slug(merchant) : "";
    const sourceLabel =
      (source.sourceField && pick(r, source.sourceField)) ||
      (merchantSlug && merchantSlug !== source.sourcePrefix
        ? `${source.sourcePrefix}:${merchantSlug}`
        : source.sourcePrefix);

    const externalId = pick(r, m.externalId) ?? deeplink;
    const ean = pick(r, m.ean) ?? pick(r, EAN_KEYS);
    const mpn = pick(r, m.mpn) ?? pick(r, MPN_KEYS);
    const market =
      (m.market && pick(r, m.market)) || source.market || inferMarket(currency);
    const country = inferCountry(
      pick(r, m.country) ?? pick(r, COUNTRY_KEYS),
      currency,
      source.defaultCountry,
    );
    // Normalize the feed's gender value (e.g. "Men", "Womens") and fall back to
    // inferring it from category/title/brand text.
    const gender = inferGender(
      String((m.gender && pick(r, m.gender)) ?? ""),
      String(rawCategory ?? ""),
      String(title),
      String(brand ?? ""),
    );

    out.push({
      source: String(sourceLabel),
      externalId: String(externalId),
      sku: pick(r, m.sku) ? String(pick(r, m.sku)) : undefined,
      ean: ean ? String(ean) : undefined,
      mpn: mpn ? String(mpn) : undefined,
      country,
      brand: brand ? String(brand) : undefined,
      title: String(title),
      description: pick(r, m.description) ? String(pick(r, m.description)) : undefined,
      category: mapCategory(rawCategory, title),
      gender,
      color: color ? String(color) : undefined,
      colorHex: m.colorHex ? pick(r, m.colorHex) : undefined,
      price: Number.isFinite(price) ? price : 0,
      currency,
      priceEur: toEur(price, currency, fxRates),
      market,
      imageUrl: pick(r, m.imageUrl) ? String(pick(r, m.imageUrl)) : undefined,
      deeplink: String(deeplink),
      inStock: parseBool(pick(r, m.inStock)),
      attrs: merchant ? { merchant: String(merchant) } : undefined,
    });
  }

  return out;
}
