-- Headwear previews (hats / caps / beanies / bandanas) chosen for face shape &
-- colour, stored as JSONB on the report like facial_hair / eyewear / accessories.

alter table public.reports
  add column if not exists headwear jsonb;

-- Recreate the public whitelist view (security invoker) with headwear so shared,
-- paid-tier reports expose it to the PDF download path for viewers.
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
  headwear,
  capsule_images,
  cover_image,
  profile
from public.reports
where is_public = true and tier <> 'free';

revoke all on public.reports_public_v from anon, authenticated, public;
grant select on public.reports_public_v to anon, authenticated;

-- Keep the anon base-table column whitelist in sync (share links use the view,
-- but the explicit grant list must include headwear to stay consistent).
grant select (headwear) on table public.reports to anon;
