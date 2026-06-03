-- Opt-in public sharing for style reports.
-- Private by default; anyone with the link can read when is_public = true.

alter table public.reports
  add column if not exists is_public boolean not null default false;

create index if not exists reports_is_public_idx
  on public.reports (is_public)
  where is_public = true;

-- Public read (anon + authenticated) when the owner enabled sharing.
drop policy if exists reports_public_select on public.reports;
create policy reports_public_select on public.reports
  for select
  using ( is_public = true );

-- Looks for publicly shared reports (report content is embedded in looks rows).
drop policy if exists looks_public_select on public.looks;
create policy looks_public_select on public.looks
  for select
  using (
    exists (
      select 1
      from public.reports r
      where r.id = looks.report_id
        and r.is_public = true
    )
  );
