insert into public.categories (name, slug, description, image_url, active, sort_order)
values
  ('Construccion en seco', 'construccion-en-seco', 'Placas, perfiles, fijaciones y accesorios.', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80', true, 1),
  ('Materiales', 'materiales', 'Cemento, cal, aridos y productos base.', 'https://images.unsplash.com/photo-1517089596392-fb9a9033e05d?auto=format&fit=crop&w=1200&q=80', true, 2),
  ('Electricidad', 'electricidad', 'Cables, cajas, termicas y canalizacion.', 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80', true, 3),
  ('Plomeria', 'plomeria', 'Canos, conexiones y selladores.', 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1200&q=80', true, 4),
  ('Pintura', 'pintura', 'Pinturas, accesorios y terminaciones.', 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1200&q=80', true, 5),
  ('Herramientas', 'herramientas', 'Herramientas manuales y electricas.', 'https://images.unsplash.com/photo-1581147036324-c1c89c2c8b5c?auto=format&fit=crop&w=1200&q=80', true, 6)
on conflict (slug) do update set
  description = excluded.description,
  image_url = excluded.image_url,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.products (
  slug, sku, name, description, category_id, subcategory, brand, price, compare_price, stock, stock_minimum, unit, image_url, gallery, specifications, featured, on_sale, active
)
select
  'placa-durlock-12-5-mm',
  'FZ-DRL-125',
  'Placa de yeso 12.5 mm',
  'Placa estandar para cielorrasos, revestimientos y tabiques interiores.',
  c.id,
  'Placas',
  'Durlock',
  12900,
  14800,
  82,
  12,
  'unidad',
  '/products/placa-yeso.svg',
  '[]'::jsonb,
  '{"espesor":"12.5 mm","uso":"Interior","medida":"1.20 x 2.40 m"}'::jsonb,
  true,
  true,
  true
from public.categories c
where c.slug = 'construccion-en-seco'
on conflict (sku) do nothing;

insert into public.products (
  slug, sku, name, description, category_id, subcategory, brand, price, stock, stock_minimum, unit, image_url, gallery, specifications, featured, active
)
select
  'cemento-portland-50-kg',
  'FZ-CEM-50',
  'Cemento Portland 50 kg',
  'Cemento de uso general para hormigones, carpetas y mezclas de obra.',
  c.id,
  'Cemento',
  'Loma Negra',
  9800,
  125,
  20,
  'bolsa',
  '/products/cemento-50kg.svg',
  '[]'::jsonb,
  '{"peso":"50 kg","tipo":"Portland","rendimiento":"Segun mezcla"}'::jsonb,
  true,
  true
from public.categories c
where c.slug = 'materiales'
on conflict (sku) do nothing;

insert into public.store_settings (key, value, public)
values
  ('brand', '{"name":"Materiales FZAC","heroTitle":"Materiales para obra con compra online","heroSubtitle":"Fortaleza Construcciones Rosario"}'::jsonb, true),
  ('delivery', '{"origin":"Rosario, Santa Fe, Argentina","maxKm":30,"baseCost":6500}'::jsonb, true)
on conflict (key) do update set value = excluded.value, public = excluded.public, updated_at = now();
