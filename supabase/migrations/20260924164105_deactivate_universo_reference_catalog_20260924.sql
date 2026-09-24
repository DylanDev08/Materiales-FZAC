update public.products p
set
  active = false,
  featured = false,
  on_sale = false,
  availability_status = 'CONSULT',
  updated_at = now()
where exists (
  select 1
  from public.product_supplier_sources pss
  where pss.product_id = p.id
    and pss.source = 'Universo Pinturas SRL Rosario'
);
