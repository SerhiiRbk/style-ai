-- Credit-based monetization foundation.
--
-- The `credits_ledger` table already exists (see 0001_init.sql) with:
--   id, user_id, delta (int), reason (text), balance_after (int), created_at.
-- This migration extends it for spend/grant accounting:
--   • adds `ref_id` so each ledger row can point at the report / try-on it paid for
--   • adds indexes for fast balance reads
--   • adds SQL helpers (balance / grant / spend) used by the app + future
--     Stripe purchase webhook. Spending is made atomic per-user with a
--     transaction-scoped advisory lock so concurrent spends cannot overdraw.
--
-- Apply in the Supabase SQL editor (project → SQL → run), or via `npm run db:migrate`.

-- ── Schema ────────────────────────────────────────────────────────────────────
alter table public.credits_ledger
  add column if not exists ref_id uuid;

create index if not exists credits_ledger_user_idx
  on public.credits_ledger (user_id, created_at desc);

-- ── Balance ───────────────────────────────────────────────────────────────────
-- Sum of all deltas for a user. Security definer so it can be called from the
-- service role or (read-only) by the owner via RLS-bypassing RPC.
create or replace function public.credits_balance(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::int
  from public.credits_ledger
  where user_id = p_user_id;
$$;

-- ── Grant ─────────────────────────────────────────────────────────────────────
-- Add credits (positive delta). Used for signup bonus, purchases (Stripe webhook
-- later), and admin/dev grants. Returns the new balance.
create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_ref_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Serialize per-user so balance_after is consistent under concurrency.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(delta), 0)::int into v_balance
  from public.credits_ledger
  where user_id = p_user_id;

  v_balance := v_balance + p_amount;

  insert into public.credits_ledger (user_id, delta, reason, ref_id, balance_after)
  values (p_user_id, p_amount, p_reason, p_ref_id, v_balance);

  return v_balance;
end;
$$;

-- ── Spend ─────────────────────────────────────────────────────────────────────
-- Deduct credits (negative delta) with a balance guard. Raises
-- 'INSUFFICIENT_CREDITS' if the user cannot afford the spend. Returns the new
-- balance on success. Atomic per-user via the advisory lock.
create or replace function public.spend_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_ref_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(delta), 0)::int into v_balance
  from public.credits_ledger
  where user_id = p_user_id;

  if v_balance < p_amount then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  v_balance := v_balance - p_amount;

  insert into public.credits_ledger (user_id, delta, reason, ref_id, balance_after)
  values (p_user_id, -p_amount, p_reason, p_ref_id, v_balance);

  return v_balance;
end;
$$;
