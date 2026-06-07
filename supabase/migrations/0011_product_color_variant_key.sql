-- Catalogue variant key: one row per (source, parent SKU, colour).
-- Same external_id with different colours are separate products; only exact
-- triple duplicates (e.g. repeated size rows) collapse on re-import.

alter table public.products
  add column if not exists color_key text not null default '';

-- Normalise existing rows so the new unique index can be applied.
update public.products
set color_key = coalesce(lower(trim(color)), '');

drop index if exists products_source_external_id_key;

create unique index if not exists products_source_external_id_color_key
  on public.products (source, external_id, color_key);
