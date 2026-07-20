-- Persistent per-user profile (the "personal cabinet"). Seeds the report wizard
-- so a returning client doesn't re-enter everything, while each report keeps its
-- own editable intake snapshot in report_intake.
--
-- Design notes (see docs/user-profile-plan.md):
--  * Stores DECLARED traits + preferences + last-used situational hints only.
--  * NO derived-appearance columns (undertone/contrast/faceShape/skinTone/
--    colorSeason): those are re-read from the photo on every report and would
--    desync if persisted. They live only in reports.profile.
--  * Stores birth_year, not age, so the profile never goes stale.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- preferences
  country text,
  city text,
  currency text,
  language text,
  occupation text,
  -- declared traits
  gender_presentation text,
  birth_year smallint,
  height_cm smallint,
  weight_kg smallint,
  body_type text,
  hair_color text,
  eye_color text,
  measurements jsonb,
  -- situational defaults (last-used hints; shown as "for your next report")
  goals jsonb,
  boldness text,
  budget_eur jsonb,
  lifestyle jsonb,
  -- provenance of a lazily-seeded profile
  seeded_from_report_id uuid references public.reports (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_rw on public.user_profiles;
create policy user_profiles_rw on public.user_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
