-- StyleAI Consultant — per-look "Shop the Look" matches
-- Stores products matched per look via per-garment vector search, keyed by the
-- look's index in the report (e.g. {"0": [...], "1": [...]}). Optional: reports
-- without it fall back to keyword matching against the global shopping list.

alter table public.reports
  add column if not exists look_items jsonb;
