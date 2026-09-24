-- Completa descripciones faltantes del catálogo curado FZAC con textos neutros por rubro.
-- No agrega prestaciones técnicas, certificaciones ni medidas que no estén ya en el nombre publicado.

update public.products p
set
  description = case
    when c.name = 'Construcción en seco' and p.subcategory = 'PVC'
      then p.name || '. Producto de PVC para soluciones de construcción en seco. La medida y presentación corresponden a la denominación publicada.'
    when c.name = 'Construcción en seco' and p.subcategory = 'Puertas'
      then p.name || '. Puerta para obra interior dentro del catálogo de construcción en seco. La medida y terminación corresponden a la denominación publicada.'
    when c.name = 'Construcción en seco' and p.subcategory = 'Cielorraso desmontable'
      then p.name || '. Componente para sistemas de cielorraso desmontable. La medida y presentación corresponden a la denominación publicada.'
    when c.name = 'Construcción en seco' and p.subcategory = 'Molduras'
      then p.name || '. Moldura para terminaciones interiores. El modelo y presentación corresponden a la denominación publicada.'
    when c.name = 'Steel Framing'
      then p.name || '. Componente para sistemas Steel Framing. El perfil, medida o presentación corresponden a la denominación publicada.'
    when c.name = 'Ferretería'
      then p.name || '. Insumo de ferretería para montaje y fijación. La cantidad, medida o presentación corresponden a la denominación publicada.'
    when c.name = 'Construcción en seco'
      then p.name || '. Material para sistemas de construcción en seco. La medida, espesor o presentación corresponden a la denominación publicada.'
    else
      p.name || '. Producto del catálogo FZAC. La unidad y presentación corresponden a la publicación.'
  end,
  updated_at = now()
from public.categories c
where p.category_id = c.id
  and p.active = true
  and (p.description is null or btrim(p.description) = '');
