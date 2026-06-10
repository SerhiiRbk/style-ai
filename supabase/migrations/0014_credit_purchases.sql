-- Stripe credit-pack purchases.
--
-- credits_ledger.ref_id is a uuid (points at the report / try-on a spend paid
-- for). Stripe identifiers (pi_…, cs_…) are opaque strings, so purchases need a
-- separate text reference plus an idempotency guard: a webhook can be delivered
-- more than once and must never grant the same purchase twice.

alter table public.credits_ledger
  add column if not exists ref_ext text;

-- One ledger row per external reference (Stripe payment id). Partial so existing
-- non-purchase rows (ref_ext null) are unaffected.
create unique index if not exists credits_ledger_ref_ext_idx
  on public.credits_ledger (ref_ext)
  where ref_ext is not null;

-- Idempotent grant keyed by an external reference. If a row with p_ref_ext
-- already exists (duplicate webhook), it's a no-op that returns the current
-- balance. Otherwise it appends a positive delta. Atomic per-user via advisory
-- lock (same pattern as grant_credits / spend_credits in 0009).
create or replace function public.grant_credits_ext(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_ref_ext text
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
  if p_ref_ext is null or length(trim(p_ref_ext)) = 0 then
    raise exception 'INVALID_REF';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Already granted for this reference → return current balance unchanged.
  select count(*) into v_exists
  from public.credits_ledger
  where ref_ext = p_ref_ext;

  select coalesce(sum(delta), 0)::int into v_balance
  from public.credits_ledger
  where user_id = p_user_id;

  if v_exists > 0 then
    return v_balance;
  end if;

  v_balance := v_balance + p_amount;

  insert into public.credits_ledger (user_id, delta, reason, ref_ext, balance_after)
  values (p_user_id, p_amount, p_reason, p_ref_ext, v_balance);

  return v_balance;
end;
$$;
