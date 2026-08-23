-- Structured garment slots for a look (lookContentSchema.items) — the
-- machine-readable mirror of `description`, consumed directly by catalogue
-- matching instead of regex-decomposing the prose. Nullable: legacy looks
-- predate it and keep falling back to decomposeLook(description).
-- Reports need no column: they persist the full ReportContent JSON, which
-- carries items since the same change. This covers set looks / extra looks,
-- whose background re-match rebuilds content from `looks` rows.
alter table public.looks add column if not exists items jsonb;
