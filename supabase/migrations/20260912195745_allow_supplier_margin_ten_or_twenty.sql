begin;

alter table public.product_supplier_sources
  drop constraint if exists product_supplier_sources_margin_percent_check;

alter table public.product_supplier_sources
  add constraint product_supplier_sources_margin_percent_check
  check (margin_percent in (10, 20));

comment on column public.product_supplier_sources.margin_percent is
  'Private supplier margin used during import: 20% general or 10% only for products clearly classified as aro/aros.';

commit;
