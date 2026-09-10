# Auditoría e integración La Yesera Rosarina — 2026-09-10

## 1. Resumen ejecutivo

Se auditó el repositorio existente sin recrearlo ni cambiar el stack. Antes de escribir en producción se generó una vista previa de 96 productos públicos de la categoría **Construcción en Seco**, se comparó contra Supabase y se retuvieron 2 coincidencias ambiguas. Después de esa revisión se insertaron 94 productos, todos con precio `Math.round(precio_origen * 1.20)`, stock `0` y disponibilidad `CONSULT`.

La importación no eliminó ni modificó los 3 productos preexistentes. La repetición en modo preview reconoce 94 productos ya vinculados y conserva los 2 casos pendientes, por lo que no duplica ni vuelve a aplicar el margen.

Dataset verificable: [`data/imports/la-yesera-construccion-en-seco.preview.json`](../../data/imports/la-yesera-construccion-en-seco.preview.json).

## 2. Baseline anterior a cambios

- Instalación solicitada con `npm install`: interrumpida porque el proyecto declara y fuerza pnpm; no se alteró el lockfile con npm.
- Instalación reproducible: `CI=true corepack pnpm install --frozen-lockfile`, correcta.
- `pnpm typecheck`: correcto.
- `pnpm build`: correcto, 74 rutas generadas.
- Advertencia de entorno: Node local `22.17.0`; el proyecto requiere `>=22.22.0 <25.0.0`.
- Supabase antes de importar: 8 categorías, 3 productos, 0 proveedores.
- El worktree ya contenía numerosas modificaciones y archivos sin seguimiento ajenos a esta tarea; se preservaron.

## 3. Fuente inspeccionada

- Categoría: <https://tienda.layeserarosarina.com.ar/construccion-en-seco/>
- Resultado: 96 productos públicos en 8 páginas de categoría.
- Subcategorías recorridas: General, Puertas, Cielorraso desmontable, PVC, Acústica y Molduras.
- Extracción acotada: datos embebidos públicamente en el listado de Tiendanube; no se realizó un crawl masivo de 96 páginas de detalle.
- Campos conservados cuando estaban presentes: nombre, precio, URL, imagen principal, marca inferible únicamente desde el nombre, subcategoría y SKU público.
- No se encontraron SKUs públicos en el listado. Se usa `LYR-{source_product_id}` como identificador técnico estable de importación, sin presentarlo como SKU del proveedor.
- Descripción, medidas estructuradas, galería y otros datos ausentes permanecen `null` o vacíos; no fueron inventados.

## 4. Vista previa y duplicados

La primera vista previa, ejecutada antes del insert, produjo:

| Estado | Cantidad |
|---|---:|
| Encontrados | 96 |
| Nuevos candidatos | 94 |
| Actualizaciones | 0 |
| Duplicados exactos omitidos | 0 |
| Potenciales duplicados retenidos | 2 |
| Precio inválido | 0 |

Casos retenidos por similitud con el producto existente `Placa Drywall 12,5mm`:

- `50254831` — `PLACAS DURLOCK 12,5mm 1,2 x 3m`
- `50254832` — `PLACAS DURLOCK 12,5mm -1,20m x 2,00m-`

No se actualizaron porque el producto existente no informa dimensiones suficientes para decidir con seguridad. La vista previa posterior al insert devuelve `update_imported: 94` y `review_potential_duplicate: 2`, confirmando idempotencia.

## 5. Importación y regla de precio

- Nuevos: 94.
- Actualizados durante la primera ejecución: 0.
- Omitidos para revisión: 2.
- Errores: 0.
- Filas de procedencia: 94.
- Verificación remota: 0 diferencias entre `products.price` y `Math.round(original_price * 1.20)`.
- El precio original queda únicamente en `product_supplier_sources.original_price`, tabla privada con RLS; el catálogo y el chatbot solo leen el precio FZAC.
- Una sincronización posterior refresca el precio desde el precio original, no desde el precio de venta, y preserva stock/disponibilidad que FZAC cargue manualmente.

## 6. Stock y disponibilidad

- Los 94 productos se insertaron con `stock = 0` y `availability_status = CONSULT`.
- Verificación remota: 0 inconsistencias de stock/disponibilidad.
- Las tarjetas y el detalle muestran **Consultar disponibilidad**, no una cantidad ficticia.
- No se permite agregar estos productos al carrito hasta que FZAC registre stock real.
- Los productos preexistentes conservaron su stock.

## 7. Imágenes

- Imágenes copiadas a Storage: 0.
- Referencias administrativas públicas encontradas: 95.
- Producto sin imagen real en origen: 1.
- Como no se confirmó autorización/licencia comercial, no se descargó, optimizó, subió ni hotlinkeó ninguna imagen del proveedor.
- El campo privado `source_image_url` conserva la referencia administrativa.
- Pendiente: solicitar al proveedor assets/fotos autorizadas para publicación; recién después subir versiones optimizadas a `product-images`.

## 8. Proveedores

Se reutilizó la tabla `suppliers` existente y se crearon:

- La Yesera Rosarina (`LA-YESERA-ROSARINA`)
- Urbe SRL (`URBE-SRL`)
- Universo Pinturas (`UNIVERSO-PINTURAS`)

Los campos CUIT, contacto, email, teléfono, condiciones y notas permanecen `null`. Los 94 productos importados están vinculados a La Yesera Rosarina; verificación remota: 0 vínculos incorrectos.

## 9. Admin de productos y proveedores

- Tabla de productos: Producto, Categoría, Precio venta, Stock, Proveedor, Estado y Acción.
- Filtro de proveedor con Todos y los proveedores reales de DB.
- Edición de producto con proveedor y disponibilidad.
- `CONSULT` se representa como “Consultar”, sin exponer costo, fuente interna ni identificadores.

## 10. Google Maps, ubicación y envío

- La clave browser y la clave server existen en el entorno local; no se imprimieron valores.
- Se agregó compatibilidad con el nombre real `GOOGLE_MAPS_SERVER_API_KEY`.
- La integración legacy Distance Matrix respondió `REQUEST_DENIED`; se migró el backend a Routes API `computeRouteMatrix` con field mask mínimo, timeout, caché, deduplicación de requests, concurrencia y rate limit.
- Prueba directa Routes API: dirección válida de Rosario devuelve ruta; dirección incompleta devuelve sin ruta. Google puede resolver cadenas falsas de forma tolerante, por lo que se reforzó la validación local de calle/altura.
- Autocomplete browser ya carga una sola instancia y la cotización se ejecuta por acción explícita, no por cada tecla.
- Retiro mantiene costo de envío `0`.
- Las variables comerciales `FZAC_SHIPPING_BASE_PRICE` y `FZAC_SHIPPING_PRICE_PER_KM` no están configuradas. Se corrigió un bug por el que strings vacíos se convertían en tarifa cero/radio de 1 km. Ahora delivery responde “Falta configurar la tarifa vigente” y no inventa un costo.
- Pendiente operativo: cargar origen oficial y tarifa aprobada; restringir en Google Cloud la clave browser por HTTP referrer y la server por API/IP. Las restricciones no se pueden comprobar desde el código.

## 11. Bugs UI/UX encontrados y corregidos

- Home quedaba activo fuera de `/`: corregido con igualdad exacta.
- Productos ahora queda activo en `/productos`, `/producto/*`, `/categorias/*`, `/categoria/*` y `/catalogo`, desktop y mobile, con `aria-current`.
- Productos sin stock real ya no dicen “Sin stock” ni muestran CTA de compra engañosa; muestran consulta.
- Las pruebas de carrito ahora seleccionan explícitamente `inStock=true` y no asumen que un producto consultable se puede comprar.
- Se validaron rutas públicas y viewports mobile sin overflow real del elemento raíz. Los carruseles internos conservan su scroll horizontal intencional.

## 12. Seguridad Admin

- `/admin` usa `requireAdmin` server-side: anónimo redirige a login, rol USER a cuenta y ADMIN accede.
- `/api/admin/*` usa contexto admin calculado en servidor; no confía en un rol enviado por el frontend.
- La service role permanece server-side y no se añadió a bundles/clientes.
- Las pruebas anónimas de APIs administrativas y mutaciones cross-origin pasan.
- CRUD de productos/proveedores permanece limitado por `is_admin()`.

## 13. Estado RLS

- Nueva tabla `product_supplier_sources`: RLS y `FORCE ROW LEVEL SECURITY`, SELECT autenticado condicionado por `is_admin()`, sin acceso anon.
- `suppliers`: acceso mediante policies admin existentes; anon bloqueado.
- `admin_audit_logs` y `payment_events`: policies de lectura admin, sin `USING (true)`.
- `products`: lectura pública limitada a productos activos; escritura admin.
- `pnpm security:check`: correcto; 37 tablas públicas verificadas por el chequeo estático.
- Hay tres migraciones de seguridad preexistentes pendientes en el historial local (`20260812000000`, `20260812010000`, `20260827090000`). No se empujaron junto con esta tarea para no mezclar trabajo ajeno ni introducir cambios productivos no auditados.

## 14. Chatbot

- Mantiene intents, base de conocimiento, contexto de catálogo real, historial corto, límite de longitud, saneamiento, rate limiting y bloqueo de prompt injection/secrets ya presentes.
- Los resultados consultan `products` y entregan precio FZAC actual.
- Productos `CONSULT` responden “disponibilidad a consultar con FZAC”; no revelan `stock = 0`, costo, proveedor ni IDs.
- Se mantienen opciones rápidas y derivación humana solo para los casos definidos por el flujo.
- El botón flotante usa el logo FZAC dentro de un contenedor circular flex, centrado, `object-fit: contain`, 56 px desktop y 48 px mobile con safe area.

## 15. Pruebas del chatbot

- Consultas comerciales normales: pasan.
- Prompt injection y solicitud de secretos: bloqueadas.
- Acceso a pedidos de terceros: bloqueado.
- Redacción de tarjeta/contacto/credenciales: pasa.
- Separación catálogo/pedidos/conocimiento: pasa.
- Persistencia solo con consentimiento: pasa.
- Respuestas con fuente FZAC y opciones rápidas: pasan en desktop, 390 px, 360 px y 414 px.

## 16. Migración realizada

`supabase/migrations/20260910131011_catalog_supplier_import_support.sql`:

- `products.supplier_id` nullable con FK `ON DELETE SET NULL`.
- `products.availability_status` con check `IN_STOCK | OUT_OF_STOCK | CONSULT`.
- Tabla privada `product_supplier_sources` para procedencia/costo/margen.
- Índices, constraints, grants mínimos y RLS admin.

Se aplicó únicamente esta migración en producción mediante un workdir temporal validado, evitando empujar las migraciones locales preexistentes pendientes.

## 17. Archivos de esta integración

- Importación/dataset: `scripts/catalog/import-la-yesera.mjs`, `data/imports/la-yesera-construccion-en-seco.preview.json`, `tests/unit/catalog-import.test.mjs`.
- DB/tipos: migración anterior, `types/domain.ts`, `types/supabase.ts`, `lib/db/admin.ts`, `lib/db/catalog.ts`, `lib/db/orders.ts`, `lib/db/fallback-data.ts`.
- Admin: `app/admin/productos/page.tsx`, `components/admin/admin-products-manager.tsx`, `lib/validations/admin.ts`.
- Catálogo: `components/catalog/catalog-page.tsx`, `components/product/product-card.tsx`, `components/product/product-buybox.tsx`.
- Navegación: `components/layout/site-nav.tsx`, `lib/utils/navigation.ts`, `styles/layout.css`, `tests/e2e/navigation.spec.ts`.
- Chatbot: `app/api/assistant/route.ts`, `components/chatbot/floating-assistant.tsx`, `styles/components.css`.
- Envío: `.env.example`, `app/api/shipping/quote/route.ts`, `lib/shipping/quote.ts`.
- QA: `tests/e2e/assistant-knowledge.spec.ts`, `tests/e2e/mobile-ui.spec.ts`, `tests/e2e/privacy-consent.spec.ts`, `tests/e2e/render-smoke.spec.ts`, `tests/e2e/security-routes.spec.ts`, `package.json`.

## 18. Resultado typecheck, lint y build

- `pnpm test`: 5/5 unitarias correctas.
- `pnpm typecheck`: correcto.
- `pnpm lint`: correcto.
- `pnpm build`: correcto.
- `pnpm security:check`: correcto.
- Se mantiene únicamente la advertencia de versión Node local inferior al mínimo declarado.

## 19. Resultado Playwright

- Primera corrida focalizada tras instalar Chromium: 32/33; el único fallo era una expectativa antigua que solo aceptaba “Agregar” o catálogo vacío.
- Primera corrida completa: 124 correctas, 40 omitidas, 16 fallos agrupados en splash no cerrado, productos consultables tratados como comprables y una medición de `body.scrollWidth` afectada por carruseles internos.
- Tras alinear las pruebas con el flujo real: suites afectadas 98 correctas, 40 omitidas y 1 fallo intermitente de carga del catálogo; el caso aislado pasa al esperar el estado cargado.
- Resultado final completo: **139 correctas, 41 omitidas y 0 fallos** en desktop Chromium y cuatro perfiles mobile. Las omisiones corresponden a escenarios condicionados por proyecto/credenciales (suite mobile en proyecto desktop y escrituras autenticadas no habilitadas).

## 20. Pendientes y despliegue

- Smoke HTTP de la web desplegada: `/`, `/productos` y `/api/health` responden 200; `/admin` responde 307 hacia la ruta administrativa configurada, sin entregar contenido admin en esa URL pública.
- Confirmar autorización comercial de imágenes y recibir assets oficiales.
- Resolver manualmente los 2 potenciales duplicados.
- Cargar stock real antes de habilitar compra de los 94 productos.
- Cargar tarifa vigente/origen oficial de delivery y verificar restricciones en Google Cloud.
- Auditar y aplicar por separado las 3 migraciones locales preexistentes pendientes.
- Ejecutar smoke autenticado USER/ADMIN con credenciales QA controladas; la suite actual valida anónimo y lógica server-side, pero no dispone de estados autenticados.
- Los cambios de código no se pushearon ni desplegaron a Render porque el worktree contiene modificaciones ajenas mezcladas y no se autorizó publicar ese conjunto. Los datos/migración sí fueron aplicados de manera selectiva a Supabase.
