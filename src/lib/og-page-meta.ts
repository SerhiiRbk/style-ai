/** Open Graph / Twitter / HTML fallbacks from a product page. */

const META_RE = /<meta\b[^>]*>/gi;
const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
const ATTR_RE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

function decodeEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const n = Number.parseInt(dec, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(tag))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

function firstMeta(
  metas: { name: string; content: string }[],
  keys: string[],
): string | null {
  const want = new Set(keys.map((k) => k.toLowerCase()));
  for (const meta of metas) {
    if (want.has(meta.name) && meta.content) return meta.content;
  }
  return null;
}

export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1"
  ) {
    return false;
  }
  if (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return false;
  }
  return true;
}

export function resolveHttpUrl(base: string, href: string): string | null {
  try {
    const resolved = new URL(href.trim(), base).href;
    return isPublicHttpUrl(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

export type PageOgMeta = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  price: string | null;
  currency: string | null;
};

const JSONLD_RE =
  /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function asList(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function nodeTypes(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  return asList((node as { "@type"?: unknown })["@type"]).map((t) =>
    String(t).toLowerCase().replace(/^https?:\/\/schema\.org\//, ""),
  );
}

function collectProducts(node: unknown, out: Record<string, unknown>[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectProducts(item, out);
    return;
  }
  const rec = node as Record<string, unknown>;
  if (nodeTypes(rec).some((t) => t === "product" || t === "productgroup")) {
    out.push(rec);
  }
  if (rec["@graph"]) collectProducts(rec["@graph"], out);
}

function jsonLdText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return decodeEntities(value.replace(/<[^>]+>/g, "")).trim() || null;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    return jsonLdText(rec.name ?? rec["@value"]);
  }
  return null;
}

function jsonLdImage(value: unknown, pageUrl: string): string | null {
  for (const item of asList(value)) {
    const raw =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? String(
              (item as { url?: unknown; contentUrl?: unknown }).url ??
                (item as { contentUrl?: unknown }).contentUrl ??
                "",
            )
          : "";
    const url = raw ? resolveHttpUrl(pageUrl, raw) : null;
    if (url) return url;
  }
  return null;
}

function parsePriceAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",") && !trimmed.includes(".")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(/,/g, "");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? String(n) : null;
}

function pickOffer(
  offers: unknown,
  pageUrl: string,
): Record<string, unknown> | null {
  const list = asList(offers).filter(
    (o): o is Record<string, unknown> => Boolean(o && typeof o === "object"),
  );
  if (!list.length) return null;
  let sku: string | null = null;
  try {
    sku = new URL(pageUrl).searchParams.get("sku");
  } catch {
    sku = null;
  }
  if (sku) {
    const hit = list.find((o) => {
      const url = typeof o.url === "string" ? o.url : "";
      const offerSku = typeof o.sku === "string" ? o.sku : "";
      return url.includes(sku) || offerSku === sku;
    });
    if (hit) return hit;
  }
  return (
    list.find((o) =>
      String(o.availability ?? "")
        .toLowerCase()
        .includes("instock"),
    ) ?? list[0]
  );
}

function parseJsonLdProduct(html: string, pageUrl: string): PageOgMeta {
  const empty: PageOgMeta = {
    title: null,
    description: null,
    imageUrl: null,
    brand: null,
    price: null,
    currency: null,
  };
  const products: Record<string, unknown>[] = [];
  JSONLD_RE.lastIndex = 0;
  let block: RegExpExecArray | null;
  while ((block = JSONLD_RE.exec(html))) {
    const raw = block[1]
      .replace(/^\s*<!--/, "")
      .replace(/-->\s*$/, "")
      .trim();
    try {
      collectProducts(JSON.parse(raw), products);
    } catch {
      /* ignore broken JSON-LD blocks */
    }
  }
  const product = products[0];
  if (!product) return empty;

  const offer = pickOffer(product.offers, pageUrl);
  const priceRaw =
    offer && (offer.price ?? offer.lowPrice ?? offer.highPrice);
  const currencyRaw =
    offer && (offer.priceCurrency ?? product.priceCurrency);

  return {
    title: jsonLdText(product.name),
    description: jsonLdText(product.description),
    imageUrl: jsonLdImage(product.image, pageUrl),
    brand: jsonLdText(product.brand) ?? jsonLdText(product.manufacturer),
    price: typeof priceRaw === "number"
      ? String(priceRaw)
      : typeof priceRaw === "string"
        ? parsePriceAmount(priceRaw)
        : null,
    currency:
      typeof currencyRaw === "string" && currencyRaw.trim()
        ? currencyRaw.trim().toUpperCase()
        : null,
  };
}

function coalesce(primary: string | null, fallback: string | null): string | null {
  return primary || fallback || null;
}

/** JSON-LD Product first, then OG / Twitter / HTML title. */
export function parseProductPageMeta(html: string, pageUrl: string): PageOgMeta {
  const jsonld = parseJsonLdProduct(html, pageUrl);
  const og = parsePageOgMeta(html, pageUrl);
  return {
    title: coalesce(jsonld.title, og.title),
    description: coalesce(jsonld.description, og.description),
    imageUrl: coalesce(jsonld.imageUrl, og.imageUrl),
    brand: coalesce(jsonld.brand, og.brand),
    price: coalesce(jsonld.price, og.price),
    currency: coalesce(jsonld.currency, og.currency),
  };
}

/** Pull title / description / image from OG, Twitter cards, then HTML fallbacks. */
export function parsePageOgMeta(html: string, pageUrl: string): PageOgMeta {
  const metas: { name: string; content: string }[] = [];
  META_RE.lastIndex = 0;
  let tag: RegExpExecArray | null;
  while ((tag = META_RE.exec(html))) {
    const attrs = parseAttrs(tag[0]);
    const name = (attrs.property || attrs.name || "").toLowerCase();
    const content = attrs.content || attrs.value || "";
    if (name && content) metas.push({ name, content });
  }

  const title =
    firstMeta(metas, ["og:title", "twitter:title"]) ??
    (() => {
      const m = html.match(TITLE_RE);
      return m?.[1] ? decodeEntities(m[1].replace(/<[^>]+>/g, "")) : null;
    })();

  const description = firstMeta(metas, [
    "og:description",
    "twitter:description",
    "description",
  ]);

  const imageRaw = firstMeta(metas, [
    "og:image:secure_url",
    "og:image:url",
    "og:image",
    "twitter:image",
    "twitter:image:src",
  ]);
  const imageUrl = imageRaw ? resolveHttpUrl(pageUrl, imageRaw) : null;
  const brand = firstMeta(metas, ["og:brand", "product:brand", "og:site_name"]);
  const price = parsePriceAmount(
    firstMeta(metas, ["og:price:amount", "product:price:amount"]) ?? "",
  );
  const currencyRaw = firstMeta(metas, [
    "og:price:currency",
    "product:price:currency",
  ]);

  return {
    title: title || null,
    description: description || null,
    imageUrl,
    brand: brand || null,
    price,
    currency: currencyRaw ? currencyRaw.toUpperCase() : null,
  };
}
