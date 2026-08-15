-- Audit trail for look try-ons: persist the exact "Shop a look" selection the
-- user submitted (productId ?? title per item), alongside the existing
-- `garments` column (0016), which records the outfit that actually went into
-- the render AFTER server-side slot fix-ups (e.g. a tie re-adds its shirt).
--
-- Storing both makes any item-vs-render mismatch diagnosable after the fact:
-- what the user picked (this column) vs what got rendered (`garments`). Only
-- look try-ons set it; catalog/outfit try-ons leave it null. Nullable so
-- existing rows and non-look kinds need no backfill; the writer
-- (api/tryon/look) also tolerates this column being absent.
alter table public.tryons
  add column if not exists selected_product_ids jsonb;
