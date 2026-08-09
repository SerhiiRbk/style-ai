-- Premium/lookbook watch styling section: one generated editorial flat-lay of
-- the recommended watch variants (case × dial × strap, no brands). Stores a
-- single 'assets'-bucket path, mirroring cover_image.

alter table public.reports
  add column if not exists watch_image text;

-- Recreate the public whitelist view (security invoker) with watch_image so
-- shared, paid-tier reports expose it to viewers (page + PDF).
drop view if exists public.reports_public_v;

create view public.reports_public_v
with (security_invoker = true) as
select
  id,
  created_at,
  tier,
  status,
  is_public,
  headline,
  summary,
  colors,
  hair,
  silhouette,
  shopping,
  do_list,
  dont_list,
  look_items,
  facial_hair,
  eyewear,
  accessories,
  capsule_images,
  cover_image,
  watch_image,
  profile
from public.reports
where is_public = true and tier <> 'free';

revoke all on public.reports_public_v from anon, authenticated, public;
grant select on public.reports_public_v to anon, authenticated;

-- Keep the anon base-table column whitelist in sync.
grant select (watch_image) on table public.reports to anon;
