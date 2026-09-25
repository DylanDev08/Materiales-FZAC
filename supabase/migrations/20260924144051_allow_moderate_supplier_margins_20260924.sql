alter table public.product_supplier_sources
  drop constraint if exists product_supplier_sources_margin_percent_check;

alter table public.product_supplier_sources
  add constraint product_supplier_sources_margin_percent_check
  check (margin_percent = any (array[
    0::numeric,
    8::numeric,
    10::numeric,
    12::numeric,
    20::numeric
  ]));
