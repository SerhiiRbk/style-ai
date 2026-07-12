-- Report language: the textual part of a report can be generated (or later
-- re-translated) into one of the supported languages. `extras` stores a
-- pre-translated snapshot of the deterministic render-time "extras" for
-- non-English reports (English reports keep computing them live).

alter table public.reports
  add column if not exists language text not null default 'en';

alter table public.reports
  add column if not exists extras jsonb;

-- Recreate the public whitelist view (security invoker) so shared, paid-tier
-- reports expose language + the translated extras snapshot to viewers/PDF.
drop view if exists public.reports_public_v;

create view public.reports_public_v
with (security_invoker = true) as
select
  id,
  created_at,
  tier,
  status,
  is_public,
  language,
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
  extras,
  profile
from public.reports
where is_public = true and tier <> 'free';

revoke all on public.reports_public_v from anon, authenticated, public;
grant select on public.reports_public_v to anon, authenticated;

-- Keep the anon base-table column whitelist in sync.
grant select (language, extras) on table public.reports to anon;
