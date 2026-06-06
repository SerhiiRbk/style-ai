import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  canonicalProductSchema,
  CATEGORIES,
  type CanonicalProductInput,
} from "../../../../../scripts/feeds/schema.mjs";
import { embedAndUpsert } from "../../../../../scripts/feeds/upsert.mjs";
import { env, hasCatalogImportKey, hasSupabaseAdmin, hasAI } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SOURCE_TYPES = ["feed", "scraper", "seed", "manual"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

// Guardrail so a single upload can't blow past embedding/DB limits.
const MAX_ITEMS = 2000;

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
  }

  const url = new URL(request.url);
  metaSource ??= url.searchParams.get("source") ?? undefined;
  metaSourceType ??= url.searchParams.get("source_type") ?? undefined;

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

  // Validate every item; collect all problems before deciding to ingest.
  const valid: CanonicalProductInput[] = [];
  const invalid: ItemIssue[] = [];

  rawItems.forEach((raw, index) => {
    // Apply the batch-level default source to items that omit one.
    const candidate =
      raw && typeof raw === "object" && metaSource && !("source" in raw)
        ? { ...(raw as Record<string, unknown>), source: metaSource }
        : raw;

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

  // Embed + upsert. Provenance (source_type, ingested_at) is stamped by the
  // upsert helper; rows dedupe on (source, external_id).
  let upserted = 0;
  try {
    upserted = await embedAndUpsert(valid as never, {
      model: env.embedModel,
      sourceType,
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

  return NextResponse.json({
    ok: true,
    received: rawItems.length,
    upserted,
    sourceType,
    source: metaSource ?? null,
    ingestedAt: new Date().toISOString(),
  });
}
