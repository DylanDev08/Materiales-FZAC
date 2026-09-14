# Auditoría de catálogo y contenido comercial FZAC

Fecha: 14 de septiembre de 2026, 12:26 a. m.
URL objetivo: http://localhost:3000
Entorno: local
Modo: lectura segura desde Supabase, sin escrituras.

## Resumen ejecutivo

Estado: **Apto para venta controlada**

| Métrica | Valor |
| --- | ---: |
| Productos totales auditados | 1770 |
| Productos activos | 1770 |
| Productos inactivos | 0 |
| Categorías totales auditadas | 9 |
| Categorías activas | 9 |
| Categorías inactivas | 0 |
| Productos destacados | 2 |
| Productos en oferta | 1 |
| Stock total visible | 120 |
| Precio mínimo activo | $ 49 |
| Precio máximo activo | $ 783.600 |

## Hallazgos

| Item | Estado | Acción sugerida |
| --- | --- | --- |
| Productos sin foto | 2 | Cargar imagen real al bucket product-images. |
| Productos con foto placeholder/banco | 2 | Reemplazar por foto real del producto o proveedor. |
| Productos con descripción débil | 113 | Completar uso, presentación y recomendaciones. |
| Productos bajo stock | 1 | Reponer o revisar stock mínimo. |
| Rubros sin imagen | 9 | Agregar imagen real o mantener ícono como fallback. |
| Rubros sin productos activos | 4 | Asignar productos o ocultar el rubro. |

## Detalle para carga comercial

### Productos sin rubro válido
_Sin elementos._

### Productos sin foto
- Clavos (20003)
- Placa Drywall 12,5mm (FZAC-DRY-125)

### Productos con foto placeholder o banco
- Clavos (20003)
- Placa Drywall 12,5mm (FZAC-DRY-125)

### Productos con imagen de host no permitido
_Sin elementos._

### Productos con descripción débil
- Impregnante hidro repelente protector incoloro 20 l IMPREGNANTE HIDRO-REP 20KG (UNV-1327)
- PGU 100-35 E 0,93 X 3 ML (LYR-120351569)
- LANA DE VIDRIO DURLOCK 14.5 X 1.20 50 MM (LYR-263661499)
- SIDING CEDAR SUPERBOARD 8 mm 3,60 X 0,2 (LYR-E0C0E103F581)
- PLACA SUPERBOARD 15mm BORDES RECTO (LYR-EB11CF0B8AFC)
- MASILLA SUPERBOARD 5 KG (LYR-9400ED4F16F7)
- PLACA SUPERBOARD 6mm BORDES RECTOS (LYR-82F59800C745)
- PLACAS DURLOCK 12,5mm 1,2 x 3m (LYR-2FC76A4B722B)
- PGU 70mm-35mm E 0,93mm X 3 mts (LYR-B9C8B7404E02)
- PLACA SUPERBOARD 8mm BORDE RECTO (LYR-BA4B29A99F7E)
- PLACA SUPERBOARD 10mm BORDE RECTO (LYR-7BD4176B38FE)
- BASE COAT BICOMPONENTE DURLOCK EXTERIORES (LYR-46B7127ECA97)
- ... 101 más

### Productos sin stock activo
_Sin elementos._

### Productos bajo stock
- Clavos (20003)

### Rubros sin productos activos
- Herramientas
- Electricidad
- Plomería
- Revestimientos

### Rubros con descripción débil
_Sin elementos._

### Rubros sin imagen propia
- Materiales de obra
- Construcción en seco
- Ferretería
- Herramientas
- Electricidad
- Plomería
- Pintura e impermeabilización
- Revestimientos
- Steel Framing

### Slugs duplicados
_Sin elementos._

### SKUs duplicados
_Sin elementos._

## Criterio de producción

- No bloquear venta por rubros sin imagen si el ícono FZAC funciona como fallback.
- Sí bloquear campañas pagas si hay slugs/SKUs duplicados, precios inválidos, rutas sin categoría o imágenes con host no permitido.
- Las fotos de banco sirven para QA visual, pero conviene reemplazarlas por fotos reales antes de SEO/indexación.
- Una consulta real vacía no debe ser reemplazada por productos ficticios; el catálogo ya mantiene ese criterio.

## Próximo control manual

- Revisar los 10 productos más vendidos desde Admin > Productos.
- Confirmar precio, unidad, stock mínimo y foto real.
- Abrir cada rubro desde mobile y validar que el primer viewport muestre productos o un estado vacío claro.
- Al publicar dominio final, activar SEO indexing recién después de que el catálogo esté saneado.
