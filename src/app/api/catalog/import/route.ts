import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  canonicalProductSchema,
  CATEGORIES,
  type CanonicalProductInput,
} from "../../../../../scripts/feeds/schema.mjs";
import { embedAndUpsert } from "../../../../../scripts/feeds/upsert.mjs";
import {
  mapCategory,
  inferMarket,
  inferGender,
  inferCountry,
  toEur,
  dedupeProducts,
} from "../../../../../scripts/feeds/normalize.mjs";
import { env, hasCatalogImportKey, hasSupabaseAdmin, hasAI } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SOURCE_TYPES = ["feed", "scraper", "seed", "manual"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

// Guardrail so a single upload can't blow past embedding/DB limits.
const MAX_ITEMS = 2000;

const GENDERS = ["men", "women", "unisex", "kids"];

// Scraped sources whose feed has no country column but is always pulled from one
// storefront (e.g. our Zara scraper reads the Spanish site). Used as the offer
// country when the row itself doesn't state one and the currency is shared (EUR).
const SOURCE_DEFAULT_COUNTRY: { match: RegExp; country: string }[] = [
  { match: /zara/i, country: "ES" },
];

function defaultCountryForSource(source: unknown): string | undefined {
  const s = typeof source === "string" ? source : "";
  return SOURCE_DEFAULT_COUNTRY.find((r) => r.match.test(s))?.country;
}

/**
 * Apply the same forgiving normalisation the feed adapters use, so a scraper can
 * emit site-native values (e.g. Zara's "PANTALON", a country code like "ES")
 * instead of having to know our canonical enums:
 *  - category → mapped onto the fixed enum (falls back to "Other")
 *  - market   → coerced to EU/US (inferred from currency when invalid)
 *  - gender   → re-inferred when not one of the allowed values
 *  - priceEur → derived from price + currency when missing
 *  - source   → defaulted from the batch-level `source`
 */
function normalizeRaw(raw: unknown, defaultSource?: string): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = { ...(raw as Record<string, unknown>) };

  if (defaultSource && !r.source) r.source = defaultSource;

  if (typeof r.category !== "string" || !CATEGORIES.includes(r.category)) {
    r.category = mapCategory(
      r.category,
      typeof r.title === "string" ? r.title : "",
    );
  }
  // Scrapers often put the storefront country in `market` (e.g. "DE") before we
  // coerce it to the coarse EU/US region — preserve it for offer-country inference.
  const rawMarket = typeof r.market === "string" ? r.market.trim().toUpperCase() : "";
  const marketCountry =
    /^[A-Z]{2}$/.test(rawMarket) && rawMarket !== "EU" && rawMarket !== "US"
      ? rawMarket
      : undefined;

  if (r.market !== "EU" && r.market !== "US") {
    r.market = inferMarket(r.currency);
  }
  if (typeof r.gender === "string" && !GENDERS.includes(r.gender)) {
    r.gender = inferGender(r.gender, r.title, r.description);
  }
  if (typeof r.priceEur !== "number" && typeof r.price === "number") {
    r.priceEur = toEur(
      r.price,
      typeof r.currency === "string" ? r.currency : "EUR",
    );
  }
  // Offer country: explicit ISO-2 → currency → per-source default → "Global".
  r.country = inferCountry(
    typeof r.country === "string" ? r.country : marketCountry,
    typeof r.currency === "string" ? r.currency : undefined,
    defaultCountryForSource(r.source),
  );
  return r;
}

/** Constant-time comparison of the provided key against the configured secret. */
function keyMatches(provided: string | null): boolean {
  const secret = env.catalogImportKey;
  if (!secret || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readApiKey(request: Request): string | null {
  const header = request.headers.get("x-api-key");
  if (header) return header;
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

type ItemIssue = {
  index: number;
  externalId?: string;
  issues: { path: string; message: string }[];
};

/**
 * Ingest scraper / feed results into the catalogue.
 *
 * Auth: send the shared secret in `x-api-key` (or `Authorization: Bearer <key>`).
 * The secret is read from the CATALOG_IMPORT_KEY env var; if it isn't set the
 * endpoint is disabled.
 *
 * Body: an array of canonical products, or `{ products: [...] }` / `{ items: [...] }`.
 * Optional top-level `source` (feed name / scraped site) is applied to any item
 * missing one, and `sourceType` (feed | scraper | seed | manual, default
 * "scraper") is stamped on every row alongside an ingested_at UTC timestamp.
 *
 * Every item is validated against the canonical schema. If any item is invalid
 * the whole upload is rejected (HTTP 422) and each problem is described in the
 * response so the scraper can be fixed.
 *
 * Duplicate rows sharing the same (source, externalId, colour) are collapsed
 * automatically (last wins) — e.g. repeated size rows for one colour. Different
 * colours under the same parent SKU are kept as separate catalogue rows.
 */
export async function POST(request: Request) {
  if (!hasCatalogImportKey) {
    return NextResponse.json(
      { error: "Catalogue import is disabled (CATALOG_IMPORT_KEY not set)." },
      { status: 503 },
    );
  }
  if (!keyMatches(readApiKey(request))) {
    return NextResponse.json(
      { error: "Invalid or missing API key." },
      { status: 401 },
    );
  }
  if (!hasSupabaseAdmin || !hasAI) {
    return NextResponse.json(
      {
        error:
          "Server not configured for ingestion (Supabase service role + AI key required).",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body is not valid JSON." },
      { status: 400 },
    );
  }

  // Accept an array, { products: [...] } or { items: [...] }, plus optional meta.
  let rawItems: unknown;
  let metaSource: string | undefined;
  let metaSourceType: string | undefined;
  let prune = false;
  if (Array.isArray(body)) {
    rawItems = body;
  } else if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    rawItems = Array.isArray(obj.products)
      ? obj.products
      : Array.isArray(obj.items)
        ? obj.items
        : undefined;
    if (typeof obj.source === "string") metaSource = obj.source;
    if (typeof obj.sourceType === "string") metaSourceType = obj.sourceType;
    if (obj.prune === true) prune = true;
  }

  const url = new URL(request.url);
  metaSource ??= url.searchParams.get("source") ?? undefined;
  metaSourceType ??= url.searchParams.get("source_type") ?? undefined;
  if (url.searchParams.get("prune") === "true") prune = true;

  if (!Array.isArray(rawItems)) {
    return NextResponse.json(
      {
        error:
          "Expected an array of products, or an object with a 'products' (or 'items') array.",
      },
      { status: 400 },
    );
  }
  if (rawItems.length === 0) {
    return NextResponse.json(
      { error: "No products supplied." },
      { status: 400 },
    );
  }
  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json(
      {
        error: `Too many products in one upload (${rawItems.length}); max is ${MAX_ITEMS}. Send in batches.`,
      },
      { status: 413 },
    );
  }

  const sourceType: SourceType = (
    SOURCE_TYPES as readonly string[]
  ).includes(metaSourceType ?? "")
    ? (metaSourceType as SourceType)
    : "scraper";
  if (metaSourceType && !SOURCE_TYPES.includes(metaSourceType as SourceType)) {
    return NextResponse.json(
      {
        error: `Invalid sourceType '${metaSourceType}'. Allowed: ${SOURCE_TYPES.join(", ")}.`,
      },
      { status: 400 },
    );
  }
  if (prune && !metaSource) {
    return NextResponse.json(
      {
        error:
          "prune requires 'source' so only that source's stale items are hidden.",
      },
      { status: 400 },
    );
  }

  // Validate every item; collect all problems before deciding to ingest.
  const valid: CanonicalProductInput[] = [];
  const invalid: ItemIssue[] = [];

  rawItems.forEach((raw, index) => {
    // Normalise site-native values onto the canonical contract before checking.
    const candidate = normalizeRaw(raw, metaSource);

    const result = canonicalProductSchema.safeParse(candidate);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({
        index,
        externalId:
          candidate && typeof candidate === "object"
            ? ((candidate as Record<string, unknown>).externalId as
                | string
                | undefined)
            : undefined,
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
  });

  if (invalid.length > 0) {
    return NextResponse.json(
      {
        error: "Validation failed — no products were imported.",
        received: rawItems.length,
        valid: valid.length,
        invalid: invalid.length,
        issues: invalid,
        allowedCategories: CATEGORIES,
      },
      { status: 422 },
    );
  }

  // Collapse exact (source, externalId, colour) duplicates — size repeats only.
  const { products: toIngest, duplicatesRemoved } = dedupeProducts(valid);

  // Captured before the upsert so freshly-imported rows (ingested_at > this)
  // are never pruned, while older same-source rows are.
  const runStartedAt = new Date().toISOString();

  // Embed + upsert. Provenance (source_type, ingested_at) is stamped by the
  // upsert helper; rows dedupe on (source, external_id, color_key). Unchanged
  // their existing embedding. With prune we also un-hide reappearing items.
  let upserted = 0;
  try {
    upserted = await embedAndUpsert(toIngest as never, {
      model: env.embedModel,
      sourceType,
      unhide: prune,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Ingestion failed while embedding/upserting.",
        detail: e instanceof Error ? e.message : "unknown error",
        received: rawItems.length,
        valid: valid.length,
      },
      { status: 500 },
    );
  }

  // Prune (full-feed semantics): hide same-source items not present in THIS
  // upload. Only safe when the upload is the complete catalogue for `source`.
  let pruned = 0;
  if (prune && metaSource) {
    const admin = createAdminSupabase();
    const { count, error } = await admin
      .from("products")
      .update({ hidden: true }, { count: "exact" })
      .eq("source", metaSource)
      .lt("ingested_at", runStartedAt)
      .eq("hidden", false);
    if (!error) pruned = count ?? 0;
  }

  return NextResponse.json({
    ok: true,
    received: rawItems.length,
    valid: valid.length,
    duplicatesRemoved,
    upserted,
    pruned,
    sourceType,
    source: metaSource ?? null,
    ingestedAt: runStartedAt,
  });
}
