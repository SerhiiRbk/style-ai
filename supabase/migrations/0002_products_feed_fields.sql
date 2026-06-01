-- Extend products for affiliate-feed ingestion + idempotent upserts.

alter table public.products
  add column if not exists external_id text,
  add column if not exists brand text,
  add column if not exists description text,
  add column if not exists gender text,
  add column if not exists original_price numeric,
  add column if not exists currency text,
  add column if not exists in_stock boolean,
  add column if not exists updated_at timestamptz default now();

-- Dedup key used by the importer's upsert (onConflict: source,external_id).
create unique index if not exists products_source_external_id_key
  on public.products (source, external_id);

-- Optional: drop out-of-stock items quickly during matching.
create index if not exists products_in_stock_idx
  on public.products (in_stock);
