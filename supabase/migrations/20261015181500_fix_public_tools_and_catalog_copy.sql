create or replace function private.is_public_catalog_entry(p_supplier_id uuid, p_category_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $function$
  select
    (
      p_supplier_id is null
      or exists (
        select 1
        from public.suppliers s
        where s.id = p_supplier_id
          and s.active = true
          and s.code in ('LA-YESERA-ROSARINA', 'UNIVERSO-PINTURAS-SRL')
      )
    )
    and exists (
      select 1
      from public.categories c
      where c.id = p_category_id
        and c.active = true
        and c.slug in (
          'construccion-en-seco',
          'steel-framing',
          'ferreteria',
          'pintura-impermeabilizacion',
          'materiales-de-obra',
          'herramientas'
        )
    );
$function$;

update public.products
set
  name = 'MASILLA DURLOCK X 18 KGS',
  description = 'MASILLA DURLOCK X 18 KGS. Material para sistemas de construcción en seco. La medida, espesor o presentación corresponden a la denominación publicada.',
  updated_at = now()
where sku = 'LYR-50254818';

update public.products
set
  name = 'MASILLA DURLOCK X 32 KGS',
  description = 'MASILLA DURLOCK X 32 KGS. Material para sistemas de construcción en seco. La medida, espesor o presentación corresponden a la denominación publicada.',
  updated_at = now()
where sku = 'LYR-50254822';

update public.products
set
  name = 'PLACAS DURLOCK R.S. 12,50mm 1,20 x 2,60',
  description = 'PLACAS DURLOCK R.S. 12,50mm 1,20 x 2,60. Material para sistemas de construcción en seco. La medida, espesor o presentación corresponden a la denominación publicada.',
  updated_at = now()
where sku = 'LYR-50254829';

update public.products
set
  name = 'PLACAS DURLOCK 12,5mm VERDE 1,20 m x 2,40 m',
  description = 'PLACA DURLOCK VERDE resistente a la humedad, 12,5 mm de espesor y medida 1,20 m x 2,40 m. Material para sistemas de construcción en seco.',
  updated_at = now()
where sku = 'LYR-50254827';

update public.products
set
  name = 'BARRIER ROLLO (10 ML x 1,22 ML) 12,20 mt2',
  updated_at = now()
where sku = 'LYR-50356518';
