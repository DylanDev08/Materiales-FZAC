-- Draft combo built from the six Universo Pinturas products used in the "Chau Filtraciones" campaign.
with bundle as (
  insert into public.products (
    slug, sku, name, description, category_id, subcategory, brand,
    price, compare_price, stock, stock_minimum, availability_status, unit,
    image_url, gallery, specifications, featured, on_sale, active,
    supplier_id, promotion_type, promotion_discount_percent
  )
  values (
    'combo-chau-filtraciones',
    'FZAC-COMBO-CHAU-FILTRACIONES',
    'Combo Chau Filtraciones',
    'Combo completo FZAC para impermeabilizar, sellar grietas y juntas, reforzar superficies y aplicar los productos. Incluye 6 productos de Universo Pinturas seleccionados para paredes y techos.',
    'ce900685-7128-4452-a85d-065c8195fe01',
    'Combos impermeabilización',
    'FZAC',
    0,
    null,
    10,
    2,
    'IN_STOCK',
    'combo',
    '',
    '[]'::jsonb,
    jsonb_build_object(
      'Tipo','Combo',
      'Cantidad de productos',6,
      'Contenido','Thermocontrol Techo 20 kg; Manta Realis 1 x 25 m; Recuplast Grietas y Juntas 1 kg; Sintex PU 50 300 ml; Rodillo Lana Brousse 22 x 40; Pinceleta Obra V4 N°40 Eco',
      'Promoción','Primera unidad a precio completo; segunda unidad con 30% de descuento'
    ),
    true,
    true,
    false,
    'b28d55b3-afbf-404f-8fcc-f3d6da9660b2',
    'SECOND_UNIT_PERCENT',
    30
  )
  on conflict (sku) do update set
    name = excluded.name,
    description = excluded.description,
    category_id = excluded.category_id,
    subcategory = excluded.subcategory,
    brand = excluded.brand,
    stock = 10,
    stock_minimum = 2,
    availability_status = 'IN_STOCK',
    unit = 'combo',
    specifications = excluded.specifications,
    featured = true,
    on_sale = true,
    active = false,
    supplier_id = excluded.supplier_id,
    promotion_type = 'SECOND_UNIT_PERCENT',
    promotion_discount_percent = 30,
    updated_at = now()
  returning id
)
insert into public.product_bundle_items (bundle_product_id, component_product_id, quantity)
select bundle.id, p.id, 1
from bundle
join public.products p
  on p.sku in ('UNV-153039','UNV-230148','UNV-10143','UNV-180717','UNV-260003','UNV-260004')
on conflict (bundle_product_id, component_product_id)
do update set quantity = 1;
