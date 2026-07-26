-- Distinguish where a catalogue-style try-on was initiated so the gallery can
-- group them (Shop a Look vs. the catalogue). Report-linked try-ons keep
-- report_id and ignore this. Existing rows default to 'catalog'.

alter table public.tryons
  add column if not exists origin text not null default 'catalog';
