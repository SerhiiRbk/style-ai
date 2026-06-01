-- Sharpen catalogue matching: filter by gender and availability, expose brand.
-- For the men's MVP, women's/kids' items must never surface; out-of-stock items
-- are excluded so the shopping list is always actionable.

-- Signature changes (new gender_filter param + brand in the result), so drop the
-- previous 5-arg version first.
drop function if exists public.match_products(vector, int, text, numeric, text);

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
    -- Gendered items must match; unisex and unlabelled items always qualify.
    and (
      gender_filter is null
      or gender is null
      or gender in (gender_filter, 'unisex')
    )
    -- Treat unknown availability as in-stock; only drop explicit out-of-stock.
    and coalesce(in_stock, true) = true
  order by embedding <=> query_embedding
  limit match_count;
$$;
