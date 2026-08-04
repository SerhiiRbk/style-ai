-- A2: soft email capture for the free colour-analysis funnel.
--
-- Captured *after* the result ("email me my palette PDF") and reused as the
-- response to the A0 daily cap ("we're at capacity — leave your email"). One row
-- per submission; the fulfilment email itself is A3 (Resend).
--
-- Email is PII: RLS on, no policies — reachable only via the service role.
--
-- Apply in the Supabase SQL editor (project -> SQL -> run), or via `npm run db:migrate`.

create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  -- Where the lead came from, e.g. 'colours_result', 'colours_cap'.
  source     text not null,
  anon_id    text,                    -- anonymous cookie id when known
  -- Colour-analysis context so the follow-up email can carry the palette.
  subseason  text,
  fulfilled  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (lower(email));
create index if not exists leads_unfulfilled_idx
  on public.leads (created_at)
  where fulfilled = false;

alter table public.leads enable row level security;
-- No policies: writes only via service role (the capture route + A3 sender).
