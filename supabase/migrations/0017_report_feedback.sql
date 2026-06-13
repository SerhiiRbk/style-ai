-- Owner feedback on a style report (rating + optional comment).

create table if not exists public.report_feedback (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create index if not exists report_feedback_report_id_idx
  on public.report_feedback (report_id);

alter table public.report_feedback enable row level security;

create policy report_feedback_select on public.report_feedback
  for select using (user_id = auth.uid());

create policy report_feedback_insert on public.report_feedback
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.reports r
      where r.id = report_id and r.user_id = auth.uid()
    )
  );

create policy report_feedback_update on public.report_feedback
  for update using (user_id = auth.uid());

create policy report_feedback_delete on public.report_feedback
  for delete using (user_id = auth.uid());
