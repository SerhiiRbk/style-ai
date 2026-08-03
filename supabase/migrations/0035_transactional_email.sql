-- A3: transactional email (Resend). Adds idempotency stamps so a given email is
-- sent at most once, an unsubscribe list for lifecycle mail, and a candidate
-- query for the "unused credits" reminder.
--
-- Apply in the Supabase SQL editor (project -> SQL -> run), or via `npm run db:migrate`.

-- One-shot claim stamps: set atomically before sending so the report-images
-- backstop cron and the inline `after()` run can never double-send.
alter table public.reports
  add column if not exists ready_email_at  timestamptz,
  add column if not exists failed_email_at timestamptz;

-- Cooldown stamp for the unused-credits reminder.
alter table public.profiles
  add column if not exists credits_reminded_at timestamptz;

-- Opt-out list for lifecycle / reminder email (transactional mail still sends).
create table if not exists public.email_unsubscribes (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table public.email_unsubscribes enable row level security;
-- No policies: written only via the service role (unsubscribe route).

-- Candidates for the unused-credits reminder: a positive balance, no ledger
-- activity for `p_inactive_days`, not reminded within `p_cooldown_days`, and not
-- unsubscribed. security definer so the service-role cron can call it directly.
create or replace function public.credit_reminder_candidates(
  p_inactive_days int,
  p_cooldown_days  int
)
returns table (user_id uuid, email text, balance int)
language sql
security definer
set search_path = public
as $$
  select p.id, p.email, public.credits_balance(p.id) as balance
  from public.profiles p
  where p.email is not null
    and public.credits_balance(p.id) > 0
    and (
      p.credits_reminded_at is null
      or p.credits_reminded_at < now() - make_interval(days => p_cooldown_days)
    )
    and not exists (
      select 1 from public.credits_ledger l
      where l.user_id = p.id
        and l.created_at > now() - make_interval(days => p_inactive_days)
    )
    and not exists (
      select 1 from public.email_unsubscribes u
      where lower(u.email) = lower(p.email)
    );
$$;
