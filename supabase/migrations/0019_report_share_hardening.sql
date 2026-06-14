-- Harden report sharing at the database layer (P0.2).
--
-- Two gaps closed:
--   1. Tier bypass — RLS lets an owner UPDATE any column, so a free-tier user
--      could set is_public=true directly via the Supabase client, bypassing the
--      tier check that lived only in /api/reports/[id]/share. A trigger now
--      forbids public sharing on the free tier regardless of client.
--   2. intake leak — reports_public_select returned the whole row (including the
--      intake JSONB: measurements, goals, budget) to anyone with the link. We
--      drop public access to the base table and expose a whitelist view that
--      omits intake and user_id. Public looks read via a SECURITY DEFINER helper
--      (no dependency on base-table RLS).

-- ── 1. Tier gate: free reports can never be public ───────────────────────────
create or replace function public.enforce_report_share_tier()
returns trigger
language plpgsql
as $$
begin
  if new.is_public is true and coalesce(new.tier, 'free') = 'free' then
    raise exception 'SHARING_NOT_ALLOWED_ON_FREE_TIER';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_share_tier_guard on public.reports;
create trigger reports_share_tier_guard
  before insert or update on public.reports
  for each row
  execute function public.enforce_report_share_tier();

-- Clean up any pre-existing bypass (free reports flagged public).
update public.reports set is_public = false where is_public = true and tier = 'free';

-- ── 2. Remove public access to the base table (it exposed intake) ─────────────
drop policy if exists reports_public_select on public.reports;

-- SECURITY DEFINER helper so child policies / the public view don't depend on
-- base-table RLS for anonymous readers. Includes the tier gate.
create or replace function public.report_is_public(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    where r.id = p_report_id
      and r.is_public = true
      and r.tier <> 'free'
  );
$$;

-- Public looks read via the helper (was an EXISTS on reports, which now has no
-- public policy and would block anon readers).
drop policy if exists looks_public_select on public.looks;
create policy looks_public_select on public.looks
  for select
  using ( public.report_is_public(report_id) );

-- ── 3. Whitelist view for public report reads ────────────────────────────────
-- security_invoker = false → runs as the view owner (postgres), bypassing the
-- base-table RLS, so only the columns listed here are ever exposed. intake and
-- user_id are intentionally omitted.
drop view if exists public.reports_public_v;
create view public.reports_public_v
with (security_invoker = false) as
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
  profile
from public.reports
where is_public = true and tier <> 'free';

-- The view runs as its owner and BYPASSES base-table RLS (security_invoker=false).
-- Supabase's default privileges grant ALL to anon/authenticated, which on an
-- auto-updatable view would allow writing to reports through it, bypassing RLS.
-- Lock the view down to read-only.
revoke all on public.reports_public_v from anon, authenticated, public;
grant select on public.reports_public_v to anon, authenticated;
