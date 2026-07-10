-- Per-report PDF cover: a bespoke editorial "magazine cover" photo generated
-- once during report generation. Stores a single 'assets'-bucket path.

alter table public.reports
  add column if not exists cover_image text;

-- Recreate the public whitelist view (security invoker) with cover_image so
-- shared, paid-tier reports expose it to the PDF download path for viewers.
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
  profile
from public.reports
where is_public = true and tier <> 'free';

revoke all on public.reports_public_v from anon, authenticated, public;
grant select on public.reports_public_v to anon, authenticated;

-- Keep the anon base-table column whitelist in sync (share links use the view,
-- but the explicit grant list must include cover_image to stay consistent).
grant select (cover_image) on table public.reports to anon;
