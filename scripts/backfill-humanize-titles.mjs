// Backfill: humanize existing catalogue titles and preserve the original.
//
//   node --env-file=.env.local scripts/backfill-humanize-titles.mjs [--dry-run] [--all] [--report path.csv] [--skip-embed]
//
// For every product: set `title_raw` (once) and rewrite `title` via the shared
// humanizer (scripts/feeds/humanize.mjs). When the title actually changes, the
// category and style tags are re-derived from the clean text and the row is
// re-embedded so semantic matching reasons over real words. A CSV of before/
// after is written for every changed row so the token expansions can be eyeballed
// before (or after) the write.
//
// Idempotent. Default pass touches only rows never backfilled (title_raw is
// null); --all reprocesses everything (e.g. after editing the token table).
// Requires AI keys for re-embedding unless --skip-embed (then changed rows keep
// their old vector until the next ingest re-embeds them).
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import { humanizeProductTitle } from "./feeds/humanize.mjs";
import { mapCategory, embedText } from "./feeds/normalize.mjs";
import { tagsFor } from "./feeds/tags.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
};
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const skipEmbed = args.includes("--skip-embed");
const reportPath = val("--report") ?? "title-humanize-report.csv";
const model = process.env.AI_EMBED_MODEL ?? "openai/text-embedding-3-small";

if (!dryRun && !skipEmbed && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
  console.error("Missing AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN (needed to re-embed). Use --skip-embed to backfill titles without vectors.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const csvCell = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const changes = [["id", "title_before", "title_after", "category_before", "category_after"]];

const PAGE = 1000;
let cursor = null;
let scanned = 0;
let updated = 0;
let reembedded = 0;

for (;;) {
  let q = sb
    .from("products")
    .select("id, brand, title, title_raw, category, color, gender, description, embedding")
    .order("id", { ascending: true })
    .limit(PAGE);
  if (cursor) q = q.gt("id", cursor);
  if (!all) q = q.is("title_raw", null);

  const { data, error } = await q;
  if (error) {
    console.error("query error:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  cursor = data[data.length - 1].id;
  scanned += data.length;

  // Compute the target row for each product; collect the ones whose descriptive
  // text changed so we can re-embed them in one batch per page.
  const pending = [];
  for (const row of data) {
    const rawTitle = row.title_raw ?? row.title ?? "";
    const cleanTitle = humanizeProductTitle(rawTitle);
    const titleChanged = cleanTitle !== row.title;
    const newCategory = titleChanged
      ? mapCategory(row.category, cleanTitle)
      : row.category;
    const tags = titleChanged
      ? tagsFor({ title: cleanTitle, category: newCategory, color: row.color })
      : null;

    // Nothing to do only when the row is already stamped AND clean (so a --all
    // re-run over already-clean rows is a no-op).
    if (row.title_raw != null && !titleChanged) continue;

    const update = { title_raw: row.title_raw ?? rawTitle, title: cleanTitle };
    if (titleChanged) {
      update.category = newCategory;
      update.formality = tags.formality ?? null;
      update.trend_level = tags.trend_level;
      update.versatility = tags.versatility;
      changes.push([row.id, row.title, cleanTitle, row.category, newCategory]);
    }
    pending.push({ row, update, titleChanged });
  }

  // Re-embed the changed rows (title/category feed embedText).
  if (!skipEmbed) {
    const toEmbed = pending.filter((p) => p.titleChanged);
    if (toEmbed.length && !dryRun) {
      const values = toEmbed.map((p) =>
        embedText({
          brand: p.row.brand,
          title: p.update.title,
          category: p.update.category,
          color: p.row.color,
          gender: p.row.gender,
          description: p.row.description,
        }),
      );
      const { embeddings } = await embedMany({ model, values });
      toEmbed.forEach((p, j) => {
        p.update.embedding = embeddings[j];
      });
      reembedded += toEmbed.length;
    }
  }

  if (dryRun) {
    updated += pending.length;
  } else {
    for (const { row, update } of pending) {
      const { error: upErr } = await sb
        .from("products")
        .update(update)
        .eq("id", row.id);
      if (upErr) console.error(`update ${row.id} failed:`, upErr.message);
      else updated++;
    }
  }

  if (scanned % 5000 < PAGE) console.log(`  … scanned ${scanned}`);
}

if (changes.length > 1) {
  await writeFile(reportPath, changes.map((r) => r.map(csvCell).join(",")).join("\n"));
  console.log(`Wrote ${changes.length - 1} changed-title rows to ${reportPath}`);
}
console.log(
  `Scanned ${scanned}, ${dryRun ? "would update" : "updated"} ${updated}` +
    (skipEmbed ? " (embeddings skipped)" : `, re-embedded ${reembedded}`) +
    ".",
);
