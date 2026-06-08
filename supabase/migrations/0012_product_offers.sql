-- Per-country offers for a catalogue product.
--
-- Background: the same physical product (e.g. a Zara shirt) is sold in many
-- countries at different prices, currencies and affiliate URLs. Previously each
-- import overwrote the single price/market/deeplink on `products`, losing the
-- other countries. We now:
--   • identify a product across feeds/countries by `product_key`
--     (EAN/GTIN → brand+mpn+colour → source:external_id:colour fallback)
--   • store one row per country in `product_offers`
-- The app keeps reading the canonical columns on `products` until Phase 2 wires
-- offer selection (so this migration is non-breaking).

-- ── Cross-country product identity ──────────────────────────────────────────
alter table public.products
  add column if not exists product_key text;

-- Backfill from existing rows. No EAN column historically, so fall back to
-- brand+sku(+colour) when an SKU is present, else the legacy source identity.
update public.products
set product_key = case
  when sku is not null and length(trim(sku)) > 0
    then 'bm:' || lower(coalesce(brand, '')) || ':' || lower(trim(sku)) || ':' || coalesce(color_key, '')
  else 'se:' || coalesce(source, '') || ':' || coalesce(external_id, '') || ':' || coalesce(color_key, '')
end
where product_key is null;

-- Non-unique on purpose: legacy rows may collide and the importer resolves
-- identity in code (select-by-key → merge), self-healing over re-imports.
create index if not exists products_product_key_idx
  on public.products (product_key);

-- ── Per-country offers ──────────────────────────────────────────────────────
create table if not exists public.product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  country text not null default 'Global', -- ISO-3166-1 alpha-2, or 'Global' = region-generic
  market text,                          -- EU | US (coarse region)
  currency text,
  price_native numeric,                 -- sale price in the offer's own currency
  original_price numeric,               -- strike-through price when known
  price_eur numeric,                    -- normalised for budget filters / ranking
  deeplink text,
  image_url text,
  in_stock boolean,
  source text,                          -- which feed/network supplied this offer
  source_type text,
  updated_at timestamptz not null default now()
);

-- One offer per (product, country). 'Global' is the region-generic offer (e.g.
-- a EUR feed that doesn't state a country).
create unique index if not exists product_offers_product_country_idx
  on public.product_offers (product_id, country);
create index if not exists product_offers_country_idx
  on public.product_offers (country);
create index if not exists product_offers_market_idx
  on public.product_offers (market);
create index if not exists product_offers_in_stock_idx
  on public.product_offers (in_stock);

alter table public.product_offers enable row level security;

-- Global catalogue data: readable by any authenticated user; writes via the
-- service role (which bypasses RLS).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_offers'
      and policyname = 'product_offers_read'
  ) then
    create policy product_offers_read on public.product_offers
      for select to authenticated using (true);
  end if;
end $$;

-- ── Backfill one offer per existing product from its current columns ─────────
-- products.original_price holds the native sale price (see feeds upsert), so it
-- maps to price_native; the strike price is unknown, so reuse it there too.
insert into public.product_offers
  (product_id, country, market, currency, price_native, original_price,
   price_eur, deeplink, image_url, in_stock, source, source_type, updated_at)
select
  p.id,
  case upper(coalesce(p.currency, ''))
    when 'GBP' then 'GB' when 'PLN' then 'PL' when 'CZK' then 'CZ'
    when 'SEK' then 'SE' when 'DKK' then 'DK' when 'NOK' then 'NO'
    when 'CHF' then 'CH' when 'USD' then 'US' when 'CAD' then 'CA'
    when 'HUF' then 'HU' when 'RON' then 'RO' when 'BGN' then 'BG'
    else 'Global'
  end,
  p.market, p.currency, p.original_price, p.original_price,
  p.price_eur, p.deeplink, p.image_url, p.in_stock, p.source, p.source_type,
  coalesce(p.updated_at, now())
from public.products p
on conflict (product_id, country) do nothing;
