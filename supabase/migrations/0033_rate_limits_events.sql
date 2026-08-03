-- A0: cost fuse for the free colour-analysis endpoint + event log.
--
-- The public `POST /api/colours` route spends a paid vision call per request and
-- was guarded only by an in-memory limiter that serverless instances do not
-- share (see docs/superpowers/specs/2026-08-01-valetti-growth-design.md §4 A0).
-- This durable, atomic counter replaces it. `events` is created here too because
-- A0's observability writes `rate_limited` to it (the fuller funnel is A1).
--
-- Apply in the Supabase SQL editor (project -> SQL -> run), or via `npm run db:migrate`.

-- Durable rate-limit counters. Access only via the service-role RPC below.
create table if not exists public.rate_limits (
  bucket     text primary key,
  hits       integer not null default 0,
  window_end timestamptz not null
);

create index if not exists rate_limits_window_end_idx
  on public.rate_limits (window_end);

alter table public.rate_limits enable row level security;
-- No policies: reachable only through the security-definer RPC (service role).

-- Atomic increment — one round-trip, no read-then-write race between instances.
-- An expired window resets the counter to 1 on the next hit, so the fixed window
-- self-heals and the cron is needed only for garbage collection.
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_limit  integer,
  p_window interval
)
returns table (allowed boolean, hit_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (bucket, hits, window_end)
  values (p_bucket, 1, now() + p_window)
  on conflict (bucket) do update
    set hits       = case when r.window_end <= now() then 1 else r.hits + 1 end,
        window_end = case when r.window_end <= now() then now() + p_window else r.window_end end
  returning r.hits into v_hits;

  return query select v_hits <= p_limit, v_hits;
end;
$$;

-- Event log. Collection now, analysis tool (PostHog) later — history is portable.
create table if not exists public.events (
  id         bigserial primary key,
  name       text not null,
  created_at timestamptz not null default now(),
  anon_id    text,                    -- anonymous cookie id; NULL for pure server events
  user_id    uuid references auth.users (id) on delete set null,
  props      jsonb not null default '{}'::jsonb
);

create index if not exists events_name_created_idx on public.events (name, created_at desc);
create index if not exists events_anon_idx on public.events (anon_id) where anon_id is not null;
create index if not exists events_user_idx  on public.events (user_id) where user_id is not null;

alter table public.events enable row level security;
-- No policies: writes only via service role.
