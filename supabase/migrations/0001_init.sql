-- StyleAI Consultant — initial schema
-- Postgres + pgvector. RLS-first: users only ever see their own data.

create extension if not exists vector;

-- ── Profiles (1:1 with auth.users) ──────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  country text,
  locale text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Consents (GDPR Art. 9 biometric processing) ─────────────────────────────
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,            -- 'biometric' | 'marketing'
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ── Photos ──────────────────────────────────────────────────────────────────
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,            -- 'face' | 'full' | 'profile' | 'current'
  storage_path text not null,    -- key in the 'photos' bucket
  quality_score numeric,
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);

-- ── Reports ──────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier text not null default 'basic',
  status text not null default 'processing',  -- processing | ready | failed
  intake jsonb not null,
  profile jsonb,
  headline text,
  summary text,
  colors jsonb,
  hair jsonb,
  silhouette jsonb,
  shopping jsonb,
  do_list jsonb,
  dont_list jsonb,
  created_at timestamptz not null default now()
);

-- ── Looks (generated outfit directions / images) ────────────────────────────
create table if not exists public.looks (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  context text,
  title text,
  description text,
  palette jsonb,
  image_path text,               -- key in the 'assets' bucket (null until generated)
  created_at timestamptz not null default now()
);

-- ── Products (affiliate catalogue) — global, embedded for semantic match ────
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  sku text,
  title text not null,
  category text,
  color text,
  price_eur numeric,
  image_url text,
  deeplink text,
  attrs jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists products_embedding_idx
  on public.products using hnsw (embedding vector_cosine_ops);

-- ── Recommendations (report → product) ──────────────────────────────────────
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  reason text,
  category text,
  rank int
);

-- ── Try-ons ───────────────────────────────────────────────────────────────────
create table if not exists public.tryons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  base_photo_id uuid references public.photos (id) on delete set null,
  image_path text,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);

-- ── Style knowledge base (RAG) — global, embedded ───────────────────────────
create table if not exists public.style_rules (
  id uuid primary key default gen_random_uuid(),
  rule_id text unique not null,
  category text,                 -- color | hair | silhouette | dress_code
  content text not null,
  embedding vector(1536)
);
create index if not exists style_rules_embedding_idx
  on public.style_rules using hnsw (embedding vector_cosine_ops);

-- ── Credits ledger ───────────────────────────────────────────────────────────
create table if not exists public.credits_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta int not null,
  reason text,
  balance_after int,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles        enable row level security;
alter table public.consents        enable row level security;
alter table public.photos          enable row level security;
alter table public.reports         enable row level security;
alter table public.looks           enable row level security;
alter table public.recommendations enable row level security;
alter table public.tryons          enable row level security;
alter table public.credits_ledger  enable row level security;
alter table public.products        enable row level security;
alter table public.style_rules     enable row level security;

-- Owner-only access for user-scoped tables.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','consents','photos','reports','looks',
    'recommendations','tryons','credits_ledger'
  ]
  loop
    execute format($f$
      create policy %1$I_select on public.%1$I for select
        using ( %2$s = auth.uid() );
      create policy %1$I_insert on public.%1$I for insert
        with check ( %2$s = auth.uid() );
      create policy %1$I_update on public.%1$I for update
        using ( %2$s = auth.uid() );
      create policy %1$I_delete on public.%1$I for delete
        using ( %2$s = auth.uid() );
    $f$, t, case when t = 'profiles' then 'id' else 'user_id' end);
  end loop;
end $$;

-- Global catalogue + knowledge base: readable by any authenticated user.
-- Writes happen via the service role, which bypasses RLS (no write policy).
create policy products_read on public.products
  for select to authenticated using (true);
create policy style_rules_read on public.style_rules
  for select to authenticated using (true);

-- ════════════════════════════════════════════════════════════════════════════
-- Storage buckets + policies (private; owner-scoped by top-level folder = uid)
-- ════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
  values ('photos', 'photos', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('assets', 'assets', false)
  on conflict (id) do nothing;

create policy "own photos read" on storage.objects for select
  using ( bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text );
create policy "own photos write" on storage.objects for insert
  with check ( bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text );
create policy "own photos delete" on storage.objects for delete
  using ( bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text );

create policy "own assets read" on storage.objects for select
  using ( bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text );

-- ════════════════════════════════════════════════════════════════════════════
-- Vector search RPCs (security definer so RLS on global tables is bypassed)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.match_style_rules(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (rule_id text, category text, content text, similarity float)
language sql stable security definer set search_path = public as $$
  select rule_id, category, content,
         1 - (embedding <=> query_embedding) as similarity
  from public.style_rules
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_products(
  query_embedding vector(1536),
  match_count int default 6,
  filter_category text default null,
  max_price numeric default null
)
returns table (
  id uuid, source text, title text, category text, color text, price_eur numeric,
  image_url text, deeplink text, similarity float
)
language sql stable security definer set search_path = public as $$
  select id, source, title, category, color, price_eur, image_url, deeplink,
         1 - (embedding <=> query_embedding) as similarity
  from public.products
  where embedding is not null
    and (filter_category is null or category = filter_category)
    and (max_price is null or price_eur <= max_price)
  order by embedding <=> query_embedding
  limit match_count;
$$;
