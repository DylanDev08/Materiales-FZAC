begin;

alter table public.product_supplier_sources
  drop constraint if exists product_supplier_sources_margin_percent_check;

alter table public.product_supplier_sources
  add constraint product_supplier_sources_margin_percent_check
  check (margin_percent in (0, 10, 20));

comment on column public.product_supplier_sources.margin_percent is
  'Margen aplicado al precio de referencia: 0 para precio publicado sin regla comercial aprobada; 10 o 20 para reglas aprobadas.';

commit;
