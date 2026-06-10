-- Persist catalog / outfit try-ons on a report with the garments used.

alter table public.tryons
  add column if not exists report_id uuid references public.reports (id) on delete cascade,
  add column if not exists kind text not null default 'product',
  add column if not exists garments jsonb;

create index if not exists tryons_report_id_idx
  on public.tryons (report_id, created_at desc);
