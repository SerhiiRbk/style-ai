-- Preserve the original feed/scraper title for provenance.
--
-- Product titles are now humanized at ingest (scripts/feeds/humanize.mjs) BEFORE
-- category classification, style tagging and embedding, so `title` holds clean,
-- readable copy and the whole matching pipeline reasons over real words. The raw
-- merchant string (e.g. "CHCKD SMCK PLLVR") is kept here so a re-humanize or an
-- audit can always recover what the source actually sent.
--
-- Nullable and not returned by match_product_offers — ingest/backfill only. A
-- one-off backfill (scripts/backfill-humanize-titles.mjs) populates existing
-- rows and re-embeds those whose title text changed.

alter table public.products
  add column if not exists title_raw text;
