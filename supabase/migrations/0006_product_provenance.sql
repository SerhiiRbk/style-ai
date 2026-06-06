-- Catalogue provenance: where each product came from, when it landed, and a
-- soft-hide flag. Lets us audit / bulk-delete / hide a whole batch — e.g. drop
-- test seeds or everything a given scraper run ingested.

alter table public.products
  -- How the row entered the catalogue.
  add column if not exists source_type text not null default 'feed',
  -- When it was (last) ingested, always stored in UTC.
  add column if not exists ingested_at timestamptz not null default now(),
  -- Soft hide: keep the row but exclude it from matching.
  add column if not exists hidden boolean not null default false;

-- Constrain source_type to the known provenance kinds.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_source_type_chk'
  ) then
    alter table public.products
      add constraint products_source_type_chk
      check (source_type in ('feed', 'scraper', 'seed', 'manual'));
  end if;
end $$;

-- Fast filtering for audit / cleanup by provenance and time.
create index if not exists products_source_type_idx on public.products (source_type);
create index if not exists products_source_idx on public.products (source);
create index if not exists products_ingested_at_idx on public.products (ingested_at);

-- Recreate match_products so hidden rows never surface in recommendations.
-- (Same 6-arg signature as 0005 — drop then recreate.)
drop function if exists public.match_products(vector, int, text, numeric, text, text);

create or replace function public.match_products(
  query_embedding vector(1536),
  match_count int default 6,
  filter_category text default null,
  max_price numeric default null,
  market_filter text default null,
  gender_filter text default null
)
returns table (
  id uuid, source text, brand text, title text, category text, color text,
  price_eur numeric, image_url text, deeplink text, market text, similarity float
)
language sql stable security definer set search_path = public as $$
  select id, source, brand, title, category, color, price_eur, image_url,
         deeplink, market,
         1 - (embedding <=> query_embedding) as similarity
  from public.products
  where embedding is not null
    and (filter_category is null or category = filter_category)
    and (max_price is null or price_eur <= max_price)
    and (market_filter is null or market is null or market = market_filter)
    and (
      gender_filter is null
      or gender is null
      or gender in (gender_filter, 'unisex')
    )
    and coalesce(in_stock, true) = true
    -- Soft-hidden items (e.g. test seeds, retired scraper batches) are skipped.
    and coalesce(hidden, false) = false
  order by embedding <=> query_embedding
  limit match_count;
$$;
