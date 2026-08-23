-- Men / women search must also keep admin "Any / unstated" rows:
-- null, '', any, unstated — plus unisex. Opposite sex and kids stay out.
-- Also return p.gender so the app can apply the same rule without SQL.

drop function if exists public.match_product_offers(
  vector, int, text, numeric, text, text, text
);

create or replace function public.match_product_offers(
  query_embedding vector(1536),
  match_count int default 8,
  filter_category text default null,
  max_price numeric default null,
  gender_filter text default null,
  p_country text default 'Global',
  p_currency text default 'EUR'
)
returns table (
  id uuid, source text, brand text, title text, category text, color text,
  color_hex text,
  formality smallint, trend_level smallint, versatility smallint,
  garment_subtype text, material_family text, fit text, pattern text, season text,
  gender text,
  price_eur numeric, price_native numeric, currency text,
  deeplink text, image_url text, market text,
  offer_country text, same_country boolean, similarity float
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.source, p.brand, p.title, p.category, p.color,
    p.color_hex,
    p.formality, p.trend_level, p.versatility,
    p.garment_subtype, p.material_family, p.fit, p.pattern, p.season,
    p.gender,
    coalesce(o.price_eur, p.price_eur)        as price_eur,
    coalesce(o.price_native, p.original_price) as price_native,
    coalesce(o.currency, p.currency)          as currency,
    coalesce(o.deeplink, p.deeplink)          as deeplink,
    coalesce(o.image_url, p.image_url)         as image_url,
    coalesce(o.market, p.market)              as market,
    coalesce(o.country, 'Global')             as offer_country,
    (o.country = upper(p_country))            as same_country,
    1 - (p.embedding <=> query_embedding)     as similarity
  from public.products p
  left join lateral (
    select po.*
    from public.product_offers po
    where po.product_id = p.id
      and coalesce(po.in_stock, true) = true
    order by
      case
        when po.country = upper(p_country)  then 0
        when po.currency = upper(p_currency) then 1
        when po.country = 'Global'          then 2
        when po.country = 'ES'              then 3
        when po.country = 'IE'              then 4
        when po.country = 'FR'              then 5
        when po.country = 'GR'              then 6
        when po.country = 'IT'              then 7
        when po.country = 'PL'              then 8
        else 100
      end,
      po.price_eur asc nulls last,
      po.updated_at desc
    limit 1
  ) o on true
  where p.embedding is not null
    and coalesce(p.hidden, false) = false
    and (filter_category is null or p.category = filter_category)
    and (max_price is null or coalesce(o.price_eur, p.price_eur) <= max_price)
    and (
      gender_filter is null
      or coalesce(nullif(trim(lower(p.gender)), ''), 'unstated')
        in (lower(gender_filter), 'unisex', 'any', 'unstated')
    )
    and coalesce(p.in_stock, true) = true
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

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
      or coalesce(nullif(trim(lower(gender)), ''), 'unstated')
        in (lower(gender_filter), 'unisex', 'any', 'unstated')
    )
    and coalesce(in_stock, true) = true
    and coalesce(hidden, false) = false
  order by embedding <=> query_embedding
  limit match_count;
$$;
