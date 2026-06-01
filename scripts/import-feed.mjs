// Universal affiliate-feed importer.
//
//   node --env-file=.env.local scripts/import-feed.mjs --source awin --url "$AWIN_FEED_URL"
//   node scripts/import-feed.mjs --source awin --file data/feeds/samples/awin.csv --dry-run
//   node scripts/import-feed.mjs --all-samples --dry-run
//
// Flags: --source <key> --file <path> --url <url> --dry-run --limit <n> --all-samples
import { SOURCES, SAMPLES } from "./feeds/sources.mjs";
import { importFeed } from "./feeds/run.mjs";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const dryRun = has("--dry-run");
const limit = val("--limit") ? parseInt(val("--limit"), 10) : undefined;
const fxRates = process.env.FX_RATES ? JSON.parse(process.env.FX_RATES) : undefined;

function report(s) {
  console.log(`\n▌ ${s.label}  (--source ${s.sourceKey})`);
  console.log(
    `  rows parsed: ${s.parsed} · canonical: ${s.canonical} · valid: ${s.valid} · invalid: ${s.invalid}`,
  );
  if (s.firstIssue) {
    console.log(`  e.g. invalid: ${s.firstIssue.path?.join(".")} — ${s.firstIssue.message}`);
  }
  for (const p of s.samples) {
    console.log(
      `   • [${p.category}] ${p.brand ? p.brand + " — " : ""}${p.title} · €${p.priceEur} · ${p.source}`,
    );
  }
  console.log(s.upserted ? `  ✓ ${s.upserted} upserted into 'products'.` : "  (dry-run — no DB writes)");
}

async function main() {
  if (has("--all-samples")) {
    console.log("Testing all adapters on sample fixtures (dry-run):");
    for (const [key, file] of Object.entries(SAMPLES)) {
      report(await importFeed({ sourceKey: key, file, dryRun: true, fxRates }));
    }
    return;
  }

  const sourceKey = val("--source");
  if (!sourceKey || !SOURCES[sourceKey]) {
    console.error(
      `Unknown --source. Available: ${Object.keys(SOURCES).join(", ")}`,
    );
    process.exit(1);
  }
  const source = SOURCES[sourceKey];
  const file = val("--file");
  const url = val("--url") || process.env[source.urlEnv];

  if (!file && !url) {
    console.error(
      `No feed input. Pass --file <path>, --url <url>, or set ${source.urlEnv} in the environment. ` +
        `Tip: try the sample → --file ${SAMPLES[sourceKey] ?? "data/feeds/samples/..."} --dry-run`,
    );
    process.exit(1);
  }
  if (!dryRun && !process.env.AI_GATEWAY_API_KEY) {
    throw new Error("Missing AI_GATEWAY_API_KEY (needed for embeddings)");
  }

  report(await importFeed({ sourceKey, file, url, dryRun, limit, fxRates }));
}

main().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
