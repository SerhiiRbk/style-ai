-- Premium personalized facial hair & eyewear preview images (JSONB, like hair).

alter table public.reports
  add column if not exists facial_hair jsonb,
  add column if not exists eyewear jsonb;
