update public.products
set
  image_url = 'https://gooxgjzetziwnxhuymmx.supabase.co/storage/v1/object/public/product-images/clavos_fzac.jpg',
  updated_at = now()
where sku = '20003'
  and (image_url is null or btrim(image_url) = '');
