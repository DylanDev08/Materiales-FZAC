# Google Merchant Center — Materiales FZAC

Estado inicial comprobado en el panel el 26/10/2026: cuenta Merchant Center `5887664702`, 122 productos, de los cuales 121 en revisión y 1 no aprobado (motivo específico no disponible mediante el feed público).

## Integración automática (sin API de pago)

- Fuente en uso: `https://www.fzacmateriales.store/google-merchant.xml`.
- Se conserva el mismo endpoint y `g:id=SKU` para no duplicar artículos al actualizar.
- El XML lee **únicamente los productos activos de Supabase**, categorías activas y stock disponible según las reservas; nunca datos locales de demostración.
- No utiliza una sesión de comprador ni cookies para consultar el catálogo.
- Si la base deja de responder, faltan las categorías o no hay productos válidos, responde HTTP 503 y `Cache-Control: no-store`. **Nunca sustituir el catálogo real por uno vacío o de demostración.**
- Los campos mínimos se validan: SKU, slug, nombre, precio positivo, imagen HTTPS. Los productos inválidos se omiten individualmente y se emite advertencia interna agregada (sin datos del cliente).
- La disponibilidad a confirmar se anuncia como `out_of_stock`, no como existencia confirmada.
- Se publican imágenes adicionales HTTPS válidas (máximo 10).
- El precio de venta simple (`on_sale` + `compare_price > price` y sin promoción por cantidad) utiliza `price` para el precio anterior y `sale_price` para el efectivo. Los combos 2x1 y descuentos por cantidad **no** se presentan como descuentos unitarios.
- Se mantienen marca y etiquetas públicas actuales y el URL de producto sin cambios para evitar reimportar el catálogo.
- Periodo de caché para producto/stock: 10 minutos (revalidación corta). La periodicidad real con la que Google recoge el feed se administra dentro de Merchant Center y puede ser más larga.
- El JSON-LD de los productos no expone claves internas `shipping_*` ni `internal_*`.

## Validación posterior al despliegue

1. Abrir el XML y verificar HTTP 200, `Content-Type: application/xml`, RSS válido y 122 productos **si el catálogo no ha cambiado**.
2. Comprobar varios SKUs (precio, stock y foto) contra la ficha y el checkout, y confirmar que los 122 IDs no cambiaron.
3. Cambiar en un entorno de prueba un stock/precio y confirmar la actualización del XML tras el TTL sin tocar pagos reales.
4. Merchant Center > Productos > Requiere atención: abrir el único producto no aprobado, **copiar su ID y motivo exacto**. No puede determinarse solo con el feed.
5. Corregir fotos genéricas o de proveedor si no muestran fielmente el producto y revisar los artículos de inventario a confirmar.
6. Verificar que Merchant Center utiliza la fuente XML activa con la sincronización programada, y no añadir una segunda fuente duplicada.
7. **Envíos:** Google Merchant Center puede tener cargada una tarifa fija temporal de 40.000 ARS; **no representa correctamente el costo real** de FZAC (aprox. 40.000 ARS/hora, mínimo una hora, ida + descarga + regreso, variable según material). Antes de anunciar productos aptos, ajustar esta política a costos reales mediante las opciones compatibles; no afirmar tarifa fija nacional ni envío gratis.
8. Comparar la política de devoluciones configurada con `/cambios-y-devoluciones`, particularmente los 10 días del derecho legal de arrepentimiento y la logística efectiva.
9. Resolver hallazgos de Next.js/Zod del issue #44 antes de cualquier deploy a producción.

## Restricciones

- La carga XML **no modifica productos en Merchant Center** de forma inmediata. Solo se sincroniza cuando Google vuelve a consultarla.
- No se han creado credenciales de Merchant API ni conectado sistemas de pago adicionales.
- No cambia la política de envíos publicada por Merchant Center; eso sigue bajo control de la cuenta.
- No se fusiona ni se despliega esta rama sin CI y revisión de diferencias.
