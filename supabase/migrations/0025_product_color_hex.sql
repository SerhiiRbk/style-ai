-- Normalised colour for catalogue products.
--
-- Feeds ship free-text colour names ("BURGANDY MARS", "Anthracite Grey"); this
-- adds a canonical hex plus coarse attributes so the app can render true colour
-- swatches and reason about colour (palette match, capsule harmony). The ingest
-- pipeline (scripts/feeds/color.mjs) fills these on every import; a one-off
-- backfill script populates existing rows.

alter table public.products
  add column if not exists color_hex text,
  add column if not exists color_family text,
  add column if not exists color_is_neutral boolean;

-- Cheap backfill for rows whose `color` already holds a hex string. The
-- dictionary-based backfill (names → hex) runs in scripts/backfill-color-hex.mjs.
update public.products
set color_hex = lower(color)
where color_hex is null
  and color ~* '^#?[0-9a-f]{6}$';

update public.products
set color_hex = '#' || lower(color)
where color_hex is not null
  and color_hex not like '#%';

-- Extend the offer-aware search to return color_hex so shopping items get a
-- real swatch colour instead of a raw merchant name.
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
  price_eur numeric, price_native numeric, currency text,
  deeplink text, image_url text, market text,
  offer_country text, same_country boolean, similarity float
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.source, p.brand, p.title, p.category, p.color,
    p.color_hex,
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
      or p.gender is null
      or p.gender in (gender_filter, 'unisex')
    )
    and coalesce(p.in_stock, true) = true
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
