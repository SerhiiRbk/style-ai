import { SOURCES } from "./sources.mjs";
import { loadFeed } from "./load.mjs";
import { parseDelimited, parseXml, parseJson } from "./parse.mjs";
import { toCanonical } from "./adapter.mjs";
import { canonicalProductSchema } from "./schema.mjs";

export function listSources() {
  return Object.keys(SOURCES);
}

export function sourceConfig(key) {
  return SOURCES[key];
}

function parseRecords(source, text) {
  if (source.format === "delimited") return parseDelimited(text, source.parse);
  if (source.format === "xml") return parseXml(text, source.parse);
  return parseJson(text);
}

/**
 * Parse + map + validate a feed (no embeddings / DB). Returns canonical
 * products ready to ingest. Used by the durable workflow (which then chunks
 * `products` into retryable ingest steps) and internally by `importFeed`.
 */
export async function prepareFeed({ sourceKey, file, url, fxRates, limit }) {
  const source = SOURCES[sourceKey];
  if (!source) throw new Error(`Unknown source: ${sourceKey}`);

  const text = await loadFeed({ file, url });
  const records = parseRecords(source, text);
  const canonical = toCanonical(records, source, { fxRates });

  const valid = [];
  let invalid = 0;
  let firstIssue = null;
  for (const c of canonical) {
    const r = canonicalProductSchema.safeParse(c);
    if (r.success) valid.push(r.data);
    else {
      invalid++;
      if (!firstIssue) firstIssue = r.error.issues[0];
    }
  }
  const products = limit ? valid.slice(0, limit) : valid;

  return {
    label: source.label,
    parsed: records.length,
    canonical: canonical.length,
    valid: valid.length,
    invalid,
    firstIssue,
    products,
  };
}

/**
 * Import one feed end-to-end. Shared by the CLI and ad-hoc use.
 * Performs embeddings + DB upsert unless `dryRun`.
 */
export async function importFeed({
  sourceKey,
  file,
  url,
  dryRun = false,
  limit,
  fxRates,
  model = process.env.AI_EMBED_MODEL || "openai/text-embedding-3-small",
}) {
  const prep = await prepareFeed({ sourceKey, file, url, fxRates, limit });

  let upserted = 0;
  if (!dryRun) {
    const { embedAndUpsert } = await import("./upsert.mjs");
    upserted = await embedAndUpsert(prep.products, { model });
  }

  return {
    sourceKey,
    label: prep.label,
    parsed: prep.parsed,
    canonical: prep.canonical,
    valid: prep.valid,
    invalid: prep.invalid,
    upserted,
    firstIssue: prep.firstIssue,
    samples: prep.products.slice(0, 3),
  };
}
