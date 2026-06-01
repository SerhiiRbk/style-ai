-- StyleAI Consultant — capsule "week of outfits" images
-- Stores an ordered array of 'assets'-bucket paths, one per outfit-matrix combo.
-- Order matches the deterministic capsuleMatrix() output for the report's shopping list.

alter table public.reports
  add column if not exists capsule_images jsonb;
