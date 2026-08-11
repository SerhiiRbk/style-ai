-- Create-a-Look: persist a "set" of AI-generated looks (several outfit
-- directions generated together for one occasion) as its own shareable
-- unit. looks.set_id links each generated look back to the set that
-- produced it; report_id is optional since a set can exist without a
-- parent Style Report in this feature.
--
-- Public sharing mirrors the reports_public_v pattern established in
-- 0008/0019/0020 (and repeated on every reports_public_v column addition
-- since, e.g. 0037/0038): a security_invoker view whitelists safe columns,
-- a matching row-level policy lets anon/authenticated read public rows, and
-- anon's base-table column grant is capped to the same whitelist. All three
-- pieces are required together — 0019/0020's history shows why: an RLS
-- policy without the column grant leaks every column (user_id, profile) to
-- a direct REST call against the base table even though the view hides
-- them, and a security_invoker view without the RLS policy just returns no
-- rows to anon. Neither half alone is enough.

create table if not exists public.look_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_id uuid references public.reports (id) on delete set null,
  occasion_id text not null,
  season text not null,
  boldness text not null,
  carlo_note text,
  name text not null,
  profile jsonb not null,            -- StyleProfile snapshot used for this set
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now()
);
create index if not exists look_sets_user_idx on public.look_sets (user_id, created_at desc);

alter table public.looks add column if not exists set_id uuid
  references public.look_sets (id) on delete cascade;
create index if not exists looks_set_idx on public.looks (set_id) where set_id is not null;

alter table public.look_sets enable row level security;

-- Owner: full CRUD on their own sets (mirrors user_profiles_rw / reports'
-- owner policies).
drop policy if exists look_sets_owner on public.look_sets;
create policy look_sets_owner on public.look_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public read: anyone (anon or authenticated) can see a row once the owner
-- shares it. Row-level half of sharing only — see the view + anon column
-- grant below for the column-level half (same split as reports_public_select
-- + the anon grant on public.reports).
drop policy if exists look_sets_public_select on public.look_sets;
create policy look_sets_public_select on public.look_sets
  for select using (is_public = true and share_slug is not null);

-- Public share view: no user_id, no profile snapshot, only public sets.
drop view if exists public.look_sets_public_v;
create view public.look_sets_public_v
  with (security_invoker = true) as
  select id, occasion_id, season, carlo_note, name, share_slug, created_at
  from public.look_sets
  where is_public = true and share_slug is not null;

revoke all on public.look_sets_public_v from anon, authenticated, public;
grant select on public.look_sets_public_v to anon, authenticated;

-- Anon share links use the view; cap direct base-table reads to the same
-- whitelist so a raw REST call against public.look_sets can't pull
-- user_id or the profile snapshot off a publicly shared row.
revoke all on table public.look_sets from anon;
grant select (
  id,
  occasion_id,
  season,
  carlo_note,
  name,
  share_slug,
  created_at
) on table public.look_sets to anon;
