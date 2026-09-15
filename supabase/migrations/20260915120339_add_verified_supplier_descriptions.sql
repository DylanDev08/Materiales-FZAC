-- Populate only concise descriptions verified against each supplier page.
-- The provenance join and blank-description guard make this migration safe to replay.

begin;

with sourced_descriptions(sku, source_url, description) as (
  values
    ('LYR-50356518', 'https://tienda.layeserarosarina.com.ar/productos/barrier-rollo-1o-ml-x-122-ml-1220-mt2/', 'Aislante acústico multipropósito de gran masa, en rollo de 3 mm de espesor y vinilo de alta densidad. Atenúa un amplio rango de frecuencias.'),
    ('LYR-50356552', 'https://tienda.layeserarosarina.com.ar/productos/barrier-rollo-25-ml-x-122-ml-305-mt2/', 'Aislante acústico multipropósito de gran masa, en rollo de 3 mm de espesor y vinilo de alta densidad. Atenúa un amplio rango de frecuencias.'),
    ('LYR-365636221', 'https://tienda.layeserarosarina.com.ar/productos/cielorraso-pvc-x-4m-roble-cipres-o-arrayan-r5dv8/', 'Cielorraso de PVC de 4 m, disponible en terminaciones Roble, Ciprés o Arrayán. El color se confirma al realizar la consulta.'),
    ('LYR-365637551', 'https://tienda.layeserarosarina.com.ar/productos/cielorraso-pvc-x-6m-roble-cipres-o-arrayan-zwmg8/', 'Cielorraso de PVC de 6 m, disponible en terminaciones Roble, Ciprés o Arrayán. El color se confirma al realizar la consulta.'),
    ('LYR-50356607', 'https://tienda.layeserarosarina.com.ar/productos/fonac-profesional-50-mm-122-x-061-cm/', 'Panel para paredes y cielorrasos, fabricado en espuma flexible de poliuretano poliéster autoextinguible, con superficie de cuñas anecoicas.'),
    ('LYR-50325485', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-04-guarda/', 'Guarda de poliestireno extruido de 40 x 2000 mm.'),
    ('LYR-50352949', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-105/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50325709', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-31r/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50325948', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-35/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50326087', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-40/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50351730', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-46/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50351808', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-49/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50351864', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-52/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50351914', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-58/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50352090', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-61r/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50352211', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-70/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50352352', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-76/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50352489', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-85/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-50352705', 'https://tienda.layeserarosarina.com.ar/productos/moldura-arquitectonica-at-90/', 'Moldura liviana y resistente en barra de 2 m. Admite distintos tipos de pintura y se instala con adhesivo especial Atenneas.'),
    ('LYR-141617811', 'https://tienda.layeserarosarina.com.ar/productos/placa-acustica-durlock-acu60/', 'Componente del Sistema Acústico Durlock diseñado para reducir la transmisión de ruido entre ambientes.'),
    ('LYR-50876617', 'https://tienda.layeserarosarina.com.ar/productos/placa-comet-durlock/', 'Placa Durlock modelo Comet, código 6023, de 610 x 610 mm.'),
    ('LYR-52371152', 'https://tienda.layeserarosarina.com.ar/productos/puerta-placa-mdf-70-cm/', 'Puerta placa MDF de 70 cm para sistemas Durlock.'),
    ('LYR-52371182', 'https://tienda.layeserarosarina.com.ar/productos/puerta-placa-mdf-80-cm/', 'Puerta placa MDF de 80 cm para sistemas Durlock.'),
    ('LYR-52371254', 'https://tienda.layeserarosarina.com.ar/productos/puerta-placa-mdf-90-cm/', 'Puerta placa MDF de 90 cm para sistemas Durlock.')
),
verified_products as (
  select p.id, sd.description
  from sourced_descriptions sd
  join public.products p on p.sku = sd.sku
  join public.product_supplier_sources pss
    on pss.product_id = p.id
   and pss.source_url = sd.source_url
  join public.suppliers s
    on s.id = pss.supplier_id
   and s.code = 'LA-YESERA-ROSARINA'
  where coalesce(btrim(p.description), '') = ''
)
update public.products p
set description = vp.description,
    updated_at = now()
from verified_products vp
where p.id = vp.id;

commit;
