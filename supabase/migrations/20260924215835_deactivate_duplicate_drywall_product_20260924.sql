begin;

-- Registro versionado de la desactivación reversible aplicada en producción.
-- Conserva la ficha histórica con stock real y evita publicar dos veces la misma
-- placa Durlock 12,5 mm 1,20 x 2,40 m.
update public.products
set active = false,
    availability_status = 'OUT_OF_STOCK',
    updated_at = now()
where id = 'cd945114-e233-4325-a3ce-e55334213c92'
  and sku = 'LYR-50254834'
  and name = 'PLACAS DURLOCK 12,5mm 1,2x2,40 m';

commit;
