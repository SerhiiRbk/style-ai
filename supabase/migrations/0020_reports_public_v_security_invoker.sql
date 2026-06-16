-- Resolve Supabase linter 0010 (SECURITY DEFINER view) on reports_public_v.
--
-- security_invoker views respect RLS on underlying tables, so intake must not
-- live on public.reports (public SELECT policy would expose every column).
-- Move intake to an owner-only side table; recreate the public view as invoker.

-- ── 1. Owner-only questionnaire storage ──────────────────────────────────────
create table if not exists public.report_intake (
  report_id uuid primary key references public.reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  intake jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists report_intake_user_id_idx
  on public.report_intake (user_id);

alter table public.report_intake enable row level security;

drop policy if exists report_intake_select on public.report_intake;
create policy report_intake_select on public.report_intake
  for select using (user_id = auth.uid());

drop policy if exists report_intake_insert on public.report_intake;
create policy report_intake_insert on public.report_intake
  for insert with check (user_id = auth.uid());

drop policy if exists report_intake_update on public.report_intake;
create policy report_intake_update on public.report_intake
  for update using (user_id = auth.uid());

drop policy if exists report_intake_delete on public.report_intake;
create policy report_intake_delete on public.report_intake
  for delete using (user_id = auth.uid());

insert into public.report_intake (report_id, user_id, intake)
select id, user_id, intake
from public.reports
on conflict (report_id) do nothing;

alter table public.reports drop column if exists intake;

-- ── 2. Public whitelist view (SECURITY INVOKER) ────────────────────────────
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
  profile
from public.reports
where is_public = true and tier <> 'free';

revoke all on public.reports_public_v from anon, authenticated, public;
grant select on public.reports_public_v to anon, authenticated;

-- Invoker view + RLS: only shared, paid-tier rows are readable.
drop policy if exists reports_public_select on public.reports;
create policy reports_public_select on public.reports
  for select
  using (is_public = true and tier <> 'free');

-- Anon share links use the view; block direct base-table reads (user_id etc.).
revoke all on table public.reports from anon;
grant select (
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
) on table public.reports to anon;
