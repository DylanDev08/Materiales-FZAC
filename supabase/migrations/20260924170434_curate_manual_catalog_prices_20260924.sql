-- Curación comercial de productos manuales FZAC.
-- Mantiene márgenes moderados del catálogo proveedor y evita publicar productos ambiguos.

update public.products
set
  price = 8500.00,
  compare_price = null,
  updated_at = now()
where id = '9b57922e-c76d-4261-ad8e-ca93b0ff3670'
  and sku = 'FZAC-CEM-50';

update public.products
set
  price = 17500.00,
  compare_price = null,
  brand = 'Durlock',
  image_url = 'https://gooxgjzetziwnxhuymmx.supabase.co/storage/v1/object/public/product-images/la-yesera-rosarina/cd945114-e233-4325-a3ce-e55334213c92.webp',
  specifications = coalesce(specifications, '{}'::jsonb) || '{"medida":"1,20 x 2,40 m","espesor":"12,5 mm","uso":"interior"}'::jsonb,
  availability_status = 'IN_STOCK',
  updated_at = now()
where id = '6ad56e25-d824-40a5-b030-63e5035aa999'
  and sku = 'FZAC-DRY-125';

update public.products
set
  active = false,
  availability_status = 'OUT_OF_STOCK',
  updated_at = now()
where id = '7d48aeb1-ac4f-4f26-80ea-0d730364eaa9'
  and sku = '20003';
