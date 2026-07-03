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

with catalog (
  category_slug, slug, sku, name, description, subcategory, brand, price, compare_price, stock, stock_minimum, unit, image_url, specifications, featured, on_sale, active
) as (
  values
    ('construccion-en-seco', 'placa-durlock-12-5-mm', 'FZ-DRL-125', 'Placa de yeso 12.5 mm', 'Placa estandar para cielorrasos, revestimientos y tabiques interiores.', 'Placas', 'Durlock', 12900, 14800, 82, 12, 'unidad', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=80', '{"espesor":"12.5 mm","uso":"Interior","medida":"1.20 x 2.40 m"}'::jsonb, true, true, true),
    ('materiales', 'cemento-portland-50-kg', 'FZ-CEM-50', 'Cemento Portland 50 kg', 'Cemento de uso general para hormigones, carpetas y mezclas de obra.', 'Cemento', 'Loma Negra', 9800, null, 125, 20, 'bolsa', 'https://images.unsplash.com/photo-1517089596392-fb9a9033e05d?auto=format&fit=crop&w=1000&q=80', '{"peso":"50 kg","tipo":"Portland","rendimiento":"Segun mezcla"}'::jsonb, true, false, true),
    ('construccion-en-seco', 'perfil-montante-70-mm', 'FZ-PER-M70', 'Perfil montante 70 mm', 'Perfil galvanizado para estructura de tabiques en construccion en seco.', 'Perfiles', 'Barbieri', 4150, 4900, 210, 30, 'tira', 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1000&q=80', '{"largo":"2.60 m","material":"Acero galvanizado","ancho":"70 mm"}'::jsonb, true, true, true),
    ('electricidad', 'llave-termica-bipolar-25a', 'FZ-ELE-T25', 'Llave termica bipolar 25A', 'Proteccion termomagnetica para instalaciones electricas domiciliarias.', 'Proteccion', 'Sica', 8900, null, 34, 8, 'unidad', 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1000&q=80', '{"amperaje":"25A","polos":2,"curva":"C"}'::jsonb, false, false, true),
    ('pintura', 'latex-interior-blanco-20-litros', 'FZ-PIN-L20', 'Latex interior blanco 20 L', 'Pintura latex para interiores con buena cobertura y terminacion mate.', 'Interior', 'Alba', 35900, 40200, 18, 6, 'balde', 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1000&q=80', '{"contenido":"20 L","terminacion":"Mate","color":"Blanco"}'::jsonb, true, true, true),
    ('plomeria', 'cano-ppr-20-mm', 'FZ-PLO-PPR20', 'Cano PPR 20 mm', 'Cano para agua fria/caliente en instalaciones sanitarias.', 'Canos', 'IPS', 2350, null, 96, 20, 'tira', 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1000&q=80', '{"diametro":"20 mm","uso":"Agua","largo":"4 m"}'::jsonb, false, false, true)
)
insert into public.products (
  slug, sku, name, description, category_id, subcategory, brand, price, compare_price, stock, stock_minimum, unit, image_url, gallery, specifications, featured, on_sale, active
)
select catalog.slug, catalog.sku, catalog.name, catalog.description, categories.id, catalog.subcategory, catalog.brand, catalog.price, catalog.compare_price, catalog.stock, catalog.stock_minimum, catalog.unit, catalog.image_url, '[]'::jsonb, catalog.specifications, catalog.featured, catalog.on_sale, catalog.active
from catalog
join public.categories categories on categories.slug = catalog.category_slug
on conflict (sku) do update set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  category_id = excluded.category_id,
  subcategory = excluded.subcategory,
  brand = excluded.brand,
  price = excluded.price,
  compare_price = excluded.compare_price,
  stock = excluded.stock,
  stock_minimum = excluded.stock_minimum,
  unit = excluded.unit,
  image_url = excluded.image_url,
  specifications = excluded.specifications,
  featured = excluded.featured,
  on_sale = excluded.on_sale,
  active = excluded.active,
  updated_at = now();

insert into public.store_settings (key, value, public)
values
  ('brand', '{"name":"Materiales FZAC","heroTitle":"Materiales para obra con compra online","heroSubtitle":"Fortaleza Construcciones Rosario"}'::jsonb, true),
  ('delivery', '{"origin":"Rosario, Santa Fe, Argentina","maxKm":30,"baseCost":6500}'::jsonb, true)
on conflict (key) do update set value = excluded.value, public = excluded.public, updated_at = now();
