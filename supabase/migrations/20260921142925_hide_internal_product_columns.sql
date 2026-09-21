revoke select on table public.products from anon, authenticated;

grant select (
  id,
  slug,
  sku,
  name,
  description,
  category_id,
  subcategory,
  brand,
  price,
  compare_price,
  stock,
  stock_minimum,
  unit,
  image_url,
  gallery,
  specifications,
  featured,
  on_sale,
  active,
  availability_status
) on table public.products to anon, authenticated;
