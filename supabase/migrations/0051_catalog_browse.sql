-- Speed up /catalog pagination: browse by recency, and distinct filter
-- options without scanning every product row from the app.
create index if not exists products_catalog_browse_idx
  on public.products (created_at desc)
  where coalesce(hidden, false) = false;

create or replace function public.catalog_filter_options()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'brands', (
      select coalesce(jsonb_agg(b order by b), '[]'::jsonb)
      from (
        select distinct brand as b
        from public.products
        where coalesce(hidden, false) = false
          and brand is not null
          and brand <> ''
      ) s
    ),
    'subcategories', (
      select coalesce(jsonb_agg(s order by s), '[]'::jsonb)
      from (
        select distinct garment_subtype as s
        from public.products
        where coalesce(hidden, false) = false
          and garment_subtype is not null
          and garment_subtype <> ''
      ) t
    )
  );
$$;

grant execute on function public.catalog_filter_options() to service_role;
