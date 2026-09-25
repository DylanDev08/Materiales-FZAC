# Auditoría de catálogo y contenido comercial FZAC

Fecha: 25 de septiembre de 2026, 12:16 a. m.
URL objetivo: http://localhost:3000
Entorno: local
Modo: lectura segura desde Supabase, sin escrituras.

## Resumen ejecutivo

Estado: **Apto para venta controlada**

| Métrica | Valor |
| --- | ---: |
| Productos totales auditados | 1770 |
| Productos activos | 112 |
| Productos inactivos | 1658 |
| Categorías totales auditadas | 9 |
| Categorías activas | 9 |
| Categorías inactivas | 0 |
| Productos destacados | 1 |
| Productos en oferta | 0 |
| Stock total visible | 115 |
| Precio mínimo activo | $ 825 |
| Precio máximo activo | $ 705.240 |

## Hallazgos

| Item | Estado | Acción sugerida |
| --- | --- | --- |
| Rubros sin imagen | 9 | Agregar imagen real o mantener ícono como fallback. |
| Rubros sin productos activos | 5 | Asignar productos o ocultar el rubro. |

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
- Herramientas
- Electricidad
- Plomería
- Pintura e impermeabilización
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
