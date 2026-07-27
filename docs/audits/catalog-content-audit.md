# Auditoría de catálogo y contenido comercial FZAC

Fecha: 27 de julio de 2026, 11:34 a. m.
URL objetivo: http://localhost:3000
Entorno: local
Modo: lectura segura desde Supabase, sin escrituras.

## Resumen ejecutivo

Estado: **Apto para venta controlada**

| Métrica | Valor |
| --- | ---: |
| Productos totales auditados | 3 |
| Productos activos | 3 |
| Productos inactivos | 0 |
| Categorías totales auditadas | 8 |
| Categorías activas | 8 |
| Categorías inactivas | 0 |
| Productos destacados | 2 |
| Productos en oferta | 1 |
| Stock total visible | 120 |
| Precio mínimo activo | $ 500 |
| Precio máximo activo | $ 12.500 |

## Hallazgos

| Item | Estado | Acción sugerida |
| --- | --- | --- |
| Productos sin foto | 2 | Cargar imagen real al bucket product-images. |
| Productos con foto placeholder/banco | 2 | Reemplazar por foto real del producto o proveedor. |
| Productos con descripción débil | 1 | Completar uso, presentación y recomendaciones. |
| Productos bajo stock | 1 | Reponer o revisar stock mínimo. |
| Rubros sin imagen | 8 | Agregar imagen real o mantener ícono como fallback. |
| Rubros sin productos activos | 5 | Asignar productos o ocultar el rubro. |

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
- Clavos (20003)

### Productos sin stock activo
_Sin elementos._

### Productos bajo stock
- Clavos (20003)

### Rubros sin productos activos
- Ferretería
- Herramientas
- Electricidad
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
