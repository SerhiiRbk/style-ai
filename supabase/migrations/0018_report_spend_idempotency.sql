-- Idempotent report-generation credit spend.
--
-- POST /api/reports charges credits before generating. A network retry or
-- double-submit must never charge the same report twice. The client now sends a
-- stable reportId (idempotency key); we enforce single-charge two ways:
--   1. A partial unique index so a given report can hold at most one 'report'
--      spend row (hard backstop, race-proof at the DB layer).
--   2. spend_credits_once(): under the per-user advisory lock, no-op when a spend
--      with the same (reason, ref_id) already exists, returning the live balance.
--
-- Only 'report' spends are constrained — try-on / regen / look_extra reuse the
-- report id as ref_id with different reasons and can legitimately repeat.
-- Refunds (reason 'report_refund') are unaffected.

-- ── Backstop: one 'report' spend per report id ───────────────────────────────
create unique index if not exists credits_ledger_report_spend_idx
  on public.credits_ledger (ref_id)
  where reason = 'report' and ref_id is not null;

-- ── Idempotent spend keyed by (reason, ref_id) ───────────────────────────────
create or replace function public.spend_credits_once(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_ref_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_exists int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_ref_id is null then
    raise exception 'INVALID_REF';
  end if;

  -- Serialize per-user so balance_after stays consistent under concurrency.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Already charged for this (reason, ref_id) → idempotent no-op.
  select count(*) into v_exists
  from public.credits_ledger
  where user_id = p_user_id and reason = p_reason and ref_id = p_ref_id;

  select coalesce(sum(delta), 0)::int into v_balance
  from public.credits_ledger
  where user_id = p_user_id;

  if v_exists > 0 then
    return v_balance;
  end if;

  if v_balance < p_amount then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  v_balance := v_balance - p_amount;

  insert into public.credits_ledger (user_id, delta, reason, ref_id, balance_after)
  values (p_user_id, -p_amount, p_reason, p_ref_id, v_balance);

  return v_balance;
end;
$$;
