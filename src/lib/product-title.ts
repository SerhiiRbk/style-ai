/**
 * Product-title humanization for the app UI.
 *
 * The implementation lives in scripts/feeds/humanize.mjs so the catalogue
 * ingest paths (feed adapter, scraper JSON import, /api/catalog/import) and the
 * app share ONE token table — no drift between what's stored and what's shown.
 * Titles are now normalised at ingest, so these calls are an idempotent safety
 * net for any legacy rows still holding raw feed copy.
 */
export {
  humanizeProductTitle,
  formatCatalogProductTitle,
} from "../../scripts/feeds/humanize.mjs";
