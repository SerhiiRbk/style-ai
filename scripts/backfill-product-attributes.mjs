// Harvest typed clothing attributes onto existing catalogue products.
//
//   node --env-file=.env.local scripts/backfill-product-attributes.mjs \
//     [--dry-run] [--only-missing] [--force] [--limit N]
//
// --dry-run       print a before→after sample + coverage; write nothing
// --only-missing  rows whose attr_typing_v is distinct from ATTR_TYPING_VERSION
// --force         recompute every row (overrides --only-missing)
// --limit N       stop after N updates (or would-updates in dry-run)
//
// Default (no --force) is --only-missing. Idempotent; keyset-paginates on id.
import { createClient } from "@supabase/supabase-js";
import {
  parseProductAttributes,
  ATTR_TYPING_VERSION,
} from "./feeds/attributes.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const onlyMissing = !force;
const limitIdx = args.indexOf("--limit");
const limit =
  limitIdx >= 0 && args[limitIdx + 1] != null
    ? Number.parseInt(args[limitIdx + 1], 10)
    : null;
if (limitIdx >= 0 && (!Number.isFinite(limit) || limit < 1)) {
  console.error("--limit must be a positive integer");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const FIELDS = [
  "garment_subtype",
  "material_family",
  "fit",
  "pattern",
  "season",
];
const PAGE = 200;
const WRITE_CHUNK = 50;
const SAMPLE = 20;

let cursor = null;
let scanned = 0;
let updated = 0;
const coverage = Object.fromEntries(FIELDS.map((f) => [f, 0]));
const sample = [];

function fmt(v) {
  return v == null ? "null" : String(v);
}

function shortField(f) {
  return f.replace("garment_", "").replace("_family", "");
}

function lineFor(prefix, values, version) {
  const bits = FIELDS.map((f) => `${shortField(f)}=${fmt(values[f])}`);
  return `    ${prefix} ${bits.join(" ")} v=${fmt(version)}`;
}

function needsWrite(row, typed) {
  if (force) return true;
  if (row.attr_typing_v !== ATTR_TYPING_VERSION) return true;
  return FIELDS.some((f) => row[f] !== typed[f]);
}

for (;;) {
  if (limit != null && updated >= limit) break;

  let q = sb
    .from("products")
    .select(
      "id, title, description, category, attrs, attr_typing_v, garment_subtype, material_family, fit, pattern, season",
    )
    .order("id", { ascending: true })
    .limit(PAGE);
  if (cursor) q = q.gt("id", cursor);
  if (onlyMissing) {
    q = q.or(
      `attr_typing_v.is.null,attr_typing_v.neq.${ATTR_TYPING_VERSION}`,
    );
  }

  const { data, error } = await q;
  if (error) {
    console.error("query error:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  cursor = data[data.length - 1].id;
  scanned += data.length;

  const pending = [];
  for (const row of data) {
    if (limit != null && updated + pending.length >= limit) break;
    const typed = parseProductAttributes({
      title: row.title,
      description: row.description,
      category: row.category,
      attrs: row.attrs,
    });
    if (!needsWrite(row, typed)) continue;
    pending.push({ row, typed });
  }

  for (const item of pending) {
    const { row, typed } = item;
    for (const f of FIELDS) if (typed[f] != null) coverage[f]++;
    if (sample.length < SAMPLE) {
      sample.push({ row, typed });
    }
    updated++;
  }

  if (!dryRun) {
    for (let i = 0; i < pending.length; i += WRITE_CHUNK) {
      const chunk = pending.slice(i, i + WRITE_CHUNK);
      const results = await Promise.all(
        chunk.map(({ row, typed }) =>
          sb
            .from("products")
            .update({
              garment_subtype: typed.garment_subtype,
              material_family: typed.material_family,
              fit: typed.fit,
              pattern: typed.pattern,
              season: typed.season,
              attr_typing_v: ATTR_TYPING_VERSION,
            })
            .eq("id", row.id),
        ),
      );
      for (const res of results) {
        if (res.error) {
          console.error("update failed:", res.error.message);
          process.exit(1);
        }
      }
    }
  }

  if (scanned % 2000 < PAGE) console.log(`  … scanned ${scanned}`);
}

console.log(
  dryRun
    ? `\nDry-run sample (${sample.length} of ${updated} would-update, scanned ${scanned}):`
    : `\nUpdated ${updated} (scanned ${scanned}). Sample:`,
);
for (const { row, typed } of sample) {
  const title = String(row.title ?? "").slice(0, 60);
  console.log(`  [${String(row.category ?? "?").padEnd(11)}] ${title}`);
  console.log(
    lineFor("before:", {
      garment_subtype: row.garment_subtype,
      material_family: row.material_family,
      fit: row.fit,
      pattern: row.pattern,
      season: row.season,
    }, row.attr_typing_v),
  );
  console.log(lineFor("after: ", typed, ATTR_TYPING_VERSION));
}

console.log(`\nCoverage (${updated} ${dryRun ? "would-update" : "updated"}):`);
for (const f of FIELDS) {
  const c = coverage[f];
  const pct = updated === 0 ? 0 : Math.round((c / updated) * 100);
  console.log(`  ${f.padEnd(18)} ${String(c).padStart(5)}/${updated}  ${pct}%`);
}

console.log(
  `\nattr_typing_v target=${ATTR_TYPING_VERSION}  mode=${force ? "force" : "only-missing"}${dryRun ? "  dry-run" : ""}`,
);
