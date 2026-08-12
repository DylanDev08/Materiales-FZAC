# Auditoría de catálogo y contenido comercial FZAC

Fecha: 12 de agosto de 2026, 12:32 p. m.
URL objetivo: http://localhost:3000
Entorno: local
Modo: lectura segura desde Supabase, sin escrituras.

## Resumen ejecutivo

Estado: **Requiere saneamiento comercial**

| Métrica | Valor |
| --- | ---: |
| Productos totales auditados | 0 |
| Productos activos | 0 |
| Productos inactivos | 0 |
| Categorías totales auditadas | 0 |
| Categorías activas | 0 |
| Categorías inactivas | 0 |
| Productos destacados | 0 |
| Productos en oferta | 0 |
| Stock total visible | 0 |
| Precio mínimo activo | - |
| Precio máximo activo | $ 0 |

## Hallazgos

| Item | Estado | Acción sugerida |
| --- | --- | --- |
| Consulta Supabase | Error | Productos: TypeError: fetch failed |
| Consulta Supabase | Error | Categorías: TypeError: fetch failed |
| Categorías activas | Bloqueante | Publicar al menos un rubro activo. |
| Productos activos | Bloqueante | Publicar productos reales antes de vender. |

## Detalle para carga comercial

### Productos sin rubro válido
_Sin elementos._

### Productos sin foto
_Sin elementos._

### Productos con foto placeholder o banco
_Sin elementos._

### Productos con imagen de host no permitido
_Sin elementos._

### Productos con descripción débil
_Sin elementos._

### Productos sin stock activo
_Sin elementos._

### Productos bajo stock
_Sin elementos._

### Rubros sin productos activos
_Sin elementos._

### Rubros con descripción débil
_Sin elementos._

### Rubros sin imagen propia
_Sin elementos._

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
