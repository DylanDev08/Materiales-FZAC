update public.products
set
  image_url = '',
  updated_at = now()
where image_url ilike '%google.com/clavos%';
