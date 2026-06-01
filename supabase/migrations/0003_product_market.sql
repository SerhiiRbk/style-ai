-- Product availability region (EU / US) for country-based filtering.
alter table public.products add column if not exists market text;
create index if not exists products_market_idx on public.products(market);

-- Replace match_products with a version that also filters by market.
-- (Adding a parameter changes the signature, so drop the old 4-arg function.)
drop function if exists public.match_products(vector, int, text, numeric);

create or replace function public.match_products(
  query_embedding vector(1536),
  match_count int default 6,
  filter_category text default null,
  max_price numeric default null,
  market_filter text default null
)
returns table (
  id uuid, source text, title text, category text, color text, price_eur numeric,
  image_url text, deeplink text, market text, similarity float
)
language sql stable security definer set search_path = public as $$
  select id, source, title, category, color, price_eur, image_url, deeplink, market,
         1 - (embedding <=> query_embedding) as similarity
  from public.products
  where embedding is not null
    and (filter_category is null or category = filter_category)
    and (max_price is null or price_eur <= max_price)
    and (market_filter is null or market is null or market = market_filter)
  order by embedding <=> query_embedding
  limit match_count;
$$;
