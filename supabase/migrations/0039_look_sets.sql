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
-- policy without the column grant leaks every column to a direct REST call
-- against the base table even though the view hides them, and a
-- security_invoker view without the RLS policy just returns no rows to anon.
-- Neither half alone is enough.
--
-- The column-grant half only ever restricts `anon`, never `authenticated` —
-- look_sets owners ARE `authenticated`, so that role can't be column-capped
-- without also blocking the owner. That means any PII column placed
-- directly on look_sets would stay readable by any logged-in non-owner via
-- `select <col> from look_sets where is_public = true`, RLS notwithstanding.
-- The StyleProfile snapshot is exactly that kind of column, so — mirroring
-- how `intake` was moved off public.reports onto the owner-only
-- public.report_intake in 0020_reports_public_v_security_invoker.sql — it
-- lives on its own owner-only side table, public.look_set_profiles, which
-- never gets a public policy or an anon grant.

create table if not exists public.look_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_id uuid references public.reports (id) on delete set null,
  occasion_id text not null,
  season text not null,
  boldness text not null,
  carlo_note text,
  name text not null,
  is_public boolean not null default false,
  share_slug text unique,
  -- Request-level idempotency key (opaque client UUID). Not PII, not in the
  -- public whitelist below, so anon can't read it.
  request_key text,
  created_at timestamptz not null default now()
);
create index if not exists look_sets_user_idx on public.look_sets (user_id, created_at desc);

-- Idempotency: the client sends a stable Idempotency-Key per "generate" intent;
-- a lost-response retry with the same key returns the existing set rather than
-- minting/charging a second one. Partial unique so rows without a key don't
-- collide on NULL.
create unique index if not exists look_sets_user_request_key_idx
  on public.look_sets (user_id, request_key)
  where request_key is not null;

alter table public.looks add column if not exists set_id uuid
  references public.look_sets (id) on delete cascade;
create index if not exists looks_set_idx on public.looks (set_id) where set_id is not null;

-- Owner-only side table for the StyleProfile snapshot (PII) — see the header
-- comment. Same shape as public.report_intake
-- (0020_reports_public_v_security_invoker.sql:8-16): primary key is the
-- parent id, owner user_id, the jsonb payload, created_at.
create table if not exists public.look_set_profiles (
  set_id uuid primary key references public.look_sets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  profile jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists look_set_profiles_user_id_idx
  on public.look_set_profiles (user_id);

alter table public.look_set_profiles enable row level security;

-- Owner-only CRUD, no public policy — mirrors report_intake's four
-- owner-scoped policies (0020:20-34), consolidated to one `for all` policy
-- for consistency with look_sets_owner above (both are equivalent for a
-- table only ever touched by its owner).
drop policy if exists look_set_profiles_owner on public.look_set_profiles;
create policy look_set_profiles_owner on public.look_set_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Belt-and-suspenders on top of RLS, same defensive redundancy as
-- 0021_schema_migrations_rls.sql: no API role should read this table
-- directly, even if a policy is ever loosened by mistake. report_intake
-- itself relies on RLS alone with no explicit revoke (its owner-only
-- policies already exclude anon, since auth.uid() is null for anon); this
-- adds the extra belt given the table holds the same class of PII.
revoke all on table public.look_set_profiles from anon;

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
-- user_id off a publicly shared row (the StyleProfile snapshot never lives
-- on this table at all — see look_set_profiles above).
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

-- Set-looks have no parent report (0001_init.sql:77 made report_id NOT NULL
-- back when every look belonged to a report). Relax it and require exactly
-- one parent instead: a look must belong to a report OR a set.
alter table public.looks alter column report_id drop not null;
alter table public.looks drop constraint if exists looks_report_or_set;
alter table public.looks add constraint looks_report_or_set
  check (report_id is not null or set_id is not null);
