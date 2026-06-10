-- Promo codes & invite links.
--
-- Admins create promotions with a code, credit grant, activation cap, and expiry.
-- Users redeem once per promo via:
--   • invite link  → /login?promo=CODE  (cookie → auto-redeem on sign-in)
--   • manual entry → POST /api/promo/redeem (logged-in users)
-- Credits land in credits_ledger with reason 'promo' and an idempotent ref_ext.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  credits int not null check (credits > 0),
  max_activations int not null check (max_activations > 0),
  activations_count int not null default 0 check (activations_count >= 0),
  expires_at timestamptz not null,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists promotions_code_idx
  on public.promotions (upper(trim(code)));

create table if not exists public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (promotion_id, user_id)
);

create index if not exists promotion_redemptions_user_idx
  on public.promotion_redemptions (user_id);

alter table public.promotions enable row level security;
alter table public.promotion_redemptions enable row level security;

-- Writes + reads happen via the service role (admin API / redeem RPC).

-- Atomically validate, record redemption, grant credits. One redemption per
-- user per promo; global cap enforced on activations_count. Idempotent via
-- ref_ext on credits_ledger (safe if called twice after a partial failure).
create or replace function public.redeem_promotion(
  p_user_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo public.promotions%rowtype;
  v_balance int;
  v_ref text;
  v_norm text;
begin
  v_norm := upper(trim(p_code));
  if v_norm = '' then
    raise exception 'PROMO_INVALID';
  end if;

  select * into v_promo
  from public.promotions
  where upper(trim(code)) = v_norm and active = true
  for update;

  if not found then
    raise exception 'PROMO_NOT_FOUND';
  end if;
  if v_promo.expires_at < now() then
    raise exception 'PROMO_EXPIRED';
  end if;
  if v_promo.activations_count >= v_promo.max_activations then
    raise exception 'PROMO_EXHAUSTED';
  end if;

  if exists (
    select 1 from public.promotion_redemptions
    where promotion_id = v_promo.id and user_id = p_user_id
  ) then
    raise exception 'PROMO_ALREADY_REDEEMED';
  end if;

  v_ref := 'promo:' || v_promo.id::text || ':' || p_user_id::text;

  if exists (
    select 1 from public.credits_ledger where ref_ext = v_ref
  ) then
    raise exception 'PROMO_ALREADY_REDEEMED';
  end if;

  insert into public.promotion_redemptions (promotion_id, user_id)
  values (v_promo.id, p_user_id);

  update public.promotions
  set activations_count = activations_count + 1
  where id = v_promo.id;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select coalesce(sum(delta), 0)::int into v_balance
  from public.credits_ledger
  where user_id = p_user_id;

  v_balance := v_balance + v_promo.credits;

  insert into public.credits_ledger (user_id, delta, reason, ref_ext, balance_after)
  values (p_user_id, v_promo.credits, 'promo', v_ref, v_balance);

  return jsonb_build_object(
    'credits', v_promo.credits,
    'balance', v_balance,
    'name', v_promo.name,
    'promotionId', v_promo.id
  );
end;
$$;
