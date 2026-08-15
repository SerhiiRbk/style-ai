-- Persist matched catalogue items per Create-a-Look set, mirroring
-- reports.look_items: a jsonb map keyed by look index → ShoppingItem[]. Lets the
-- set view render "Shop the look" and (later) the whole-look try-on resolve
-- items without recomputing the catalogue match on every view.
--
-- Not PII (public catalogue products), and NOT added to the anon column-grant
-- whitelist in 0039, so anon still can't read it off a shared row.
alter table public.look_sets add column if not exists look_items jsonb;
