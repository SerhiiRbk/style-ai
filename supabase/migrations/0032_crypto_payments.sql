-- Crypto credit-pack purchases (NOWPayments).
--
-- credits_ledger.ref_ext already gives idempotent grants (np_<orderId>), but a
-- crypto payment settles over minutes across several IPN callbacks, so we need a
-- durable "invoice → user → package → status" record for the pending UI, the
-- status poll, cron reconciliation, and accounting.
--
-- Apply in the Supabase SQL editor (project → SQL → run), or via `npm run db:migrate`.

create table if not exists public.crypto_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'nowpayments',
  package_id text not null,
  credits int not null check (credits > 0),
  amount_eur numeric not null check (amount_eur > 0),
  -- NOWPayments invoice/payment identifiers, filled as they become known.
  invoice_id text,
  payment_id text,
  pay_currency text,
  pay_amount numeric,
  actually_paid numeric,
  status text not null default 'waiting',
  credited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crypto_payments_user_idx
  on public.crypto_payments (user_id, created_at desc);

create index if not exists crypto_payments_status_idx
  on public.crypto_payments (status)
  where status in ('waiting', 'confirming', 'confirmed', 'sending');

alter table public.crypto_payments enable row level security;

-- Owner can read their own payments (drives the pending/status UI). All writes
-- happen via the service role (checkout route + IPN webhook), which bypasses RLS.
drop policy if exists crypto_payments_select_own on public.crypto_payments;
create policy crypto_payments_select_own
  on public.crypto_payments
  for select
  using (auth.uid() = user_id);
