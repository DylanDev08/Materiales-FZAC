update public.products
set
  availability_status = 'CONSULT',
  featured = false,
  on_sale = false,
  compare_price = null,
  updated_at = now()
where sku = 'FZAC-DRY-125'
  and supplier_id is null;
