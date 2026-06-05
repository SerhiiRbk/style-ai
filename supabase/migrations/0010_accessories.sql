-- Premium paid add-on: accessory styling previews (scarves / neckwear / ties),
-- stored as JSONB on the report like facial_hair / eyewear.

alter table public.reports
  add column if not exists accessories jsonb;
