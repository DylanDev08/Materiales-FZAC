# Auditoría de catálogo, proveedores, envíos y chatbot

Fecha de ejecución: 10/11 de septiembre de 2026 (America/Buenos_Aires).

> Actualización del 12/09/2026: la continuación de catálogo, precios, imágenes, UX y QA está documentada en [`catalog-ui-ux-continuation-2026-09-12.md`](./catalog-ui-ux-continuation-2026-09-12.md). Esa auditoría, con 114 productos totales y 111 vinculados a Yesera, prevalece sobre las cantidades históricas de este documento.

## 1. Productos encontrados en La Yesera Rosarina

- Fuente limitada a `Construcción en Seco`: <https://tienda.layeserarosarina.com.ar/construccion-en-seco/>.
- Vista previa inicial: 96 filas públicas, revisadas antes de la primera inserción.
- Estado productivo consolidado tras integrar la rama remota preexistente: 109 productos con procedencia verificable de La Yesera Rosarina.
- Dataset inicial: [`data/imports/la-yesera-construccion-en-seco.preview.json`](../../data/imports/la-yesera-construccion-en-seco.preview.json).
- Dataset productivo completo: [`data/imports/la-yesera-production-audit.json`](../../data/imports/la-yesera-production-audit.json).

## 2. Productos importados

- 109 productos activos vinculados al proveedor `LA-YESERA-ROSARINA`.
- Catálogo público: 85 en Construcción en seco, 11 en Steel Framing y 13 en Ferretería.
- No se borraron ni sobrescribieron productos históricos de otros proveedores; se ocultan solamente en la consulta pública y continúan disponibles en Admin.

## 3. Duplicados

- Control final por `source_product_id`, SKU, slug y nombre normalizado: 0 duplicados exactos.
- La importación usa procedencia única por proveedor/producto externo e impide aplicar el margen dos veces.
- La vista previa y clasificación aplicada están en [`data/imports/fzac-storefront-taxonomy.preview.json`](../../data/imports/fzac-storefront-taxonomy.preview.json).

## 4. Precios originales

- Los 109 valores originales se conservan en `product_supplier_sources.original_price`, fuera de las consultas públicas.
- Rango observado en la fuente: ARS 750 a ARS 653.000.
- El detalle producto por producto está en el dataset productivo; no se expone costo ni procedencia al cliente.

## 5. Precios FZAC (+20%)

- Fórmula verificada: `Math.round(original_price * 1.20)`.
- Rango FZAC: ARS 900 a ARS 783.600.
- Auditoría final: 0 diferencias de margen sobre 109 filas y 0 doble incremento.

## 6. Imágenes

- 109/109 productos tienen URL propia en el bucket público `product-images`, bajo `la-yesera-rosarina/*.webp`.
- 108 imágenes se descargaron de assets públicos autorizados, se rotaron/limitaron a 1200 px y se convirtieron a WebP.
- Un detalle fuente devolvía 404 (`BASE COAT BICOMPONENTE DURLOCK EXTERIORES`); se generó un asset neutro propio, sin marca ni texto inventado, y se subió al mismo Storage.
- No hay hotlink permanente y no se eliminaron imágenes existentes.
- Vista previa y resultado: [`data/imports/la-yesera-images.preview.json`](../../data/imports/la-yesera-images.preview.json).

## 7. Proveedores

El panel Admin muestra exactamente los tres proveedores solicitados:

- Yesera Rosarina (`LA-YESERA-ROSARINA`).
- Urbe SRL (`URBE-SRL`).
- Maquinaria Sorrentos (`MAQUINARIA-SORRENTOS`).

No se inventaron CUIT, teléfono, email, dirección ni condiciones comerciales. La fila anterior de Universo Pinturas se renombró de forma no destructiva, conservando su UUID y relaciones.

## 8. Google Maps y tarifa de envío

- La integración backend usa Routes API `computeRouteMatrix`, clave exclusivamente server-side, field mask mínimo, timeout de 7 s, caché, deduplicación, límite de concurrencia y rate limit.
- Autocomplete usa clave browser separada y carga controlada; no cotiza por cada tecla.
- Retiro mantiene envío ARS 0.
- La Yesera muestra la etiqueta pública `Envío gratis`, pero eso no define la tarifa comercial de FZAC. La configuración temporal en ARS 0 fue retirada; delivery falla cerrado hasta recibir base, precio por km, mínimo/radio o una tabla porcentual explícita.
- Si las variables de tarifa o Maps faltan, el backend sigue fallando cerrado con importe 0 y mensaje explícito; nunca inventa flete.
- `render.yaml` declara claves browser/server por separado y las variables comerciales como secretos/valores operativos externos.
- Las claves browser/server se cargaron directamente en Render sin exponerlas en Git. La distancia se consulta con Routes API, pero no se cobra un importe inventado mientras falte la regla comercial exacta.

## 9. Bugs UI/UX encontrados

- Home genérica y con rubros fuera del catálogo fuente: reemplazada por una tienda enfocada en construcción en seco, Steel Framing y Ferretería.
- Home ahora incluye hero comercial, carril real de productos, tres categorías y compra por necesidad.
- Catálogo con filtros redundantes: se simplificó y se agregó disponibilidad (`Disponible`, `Consultar disponibilidad`, `Sin stock`).
- Mensajes genéricos de Zod en dirección: reemplazados por errores claros en español.
- PWA con logo pequeño dentro de un cuadrado negro: iconos 192/512, Apple y maskable regenerados con mayor ocupación visual.
- Botón del asistente: logo WebP propio, centrado con flex, `object-fit: contain`, 56 px desktop y 48 px mobile.

## 10. Bug Home/Productos

- `/` activa exclusivamente Inicio.
- `/productos`, `/producto/*`, `/categorias/*` y `/categoria/*` activan Productos.
- Corregido en navegación desktop y mobile con `aria-current`; el test ya no depende de un producto histórico oculto.

## 11. Seguridad Admin

- `/admin` anónimo bloqueado/redirigido y sin datos sensibles.
- Los handlers `/api/admin/*` calculan el rol server-side; no aceptan rol del frontend.
- La service role sigue limitada a módulos `server-only` y scripts operativos locales; no se incluyó en bundles cliente.
- Productos, proveedores, pagos, eventos, auditoría y uploads conservan autorización Admin.

## 12. Estado RLS

- Chequeo automático: 37 tablas públicas con `FORCE ROW LEVEL SECURITY` requerido.
- `product_supplier_sources` y proveedores no exponen costo/procedencia al catálogo anónimo.
- No se añadió ninguna policy sensible con `USING (true)`.
- La lectura pública de productos continúa limitada a activos; la aplicación agrega el filtro server-side de proveedor/categorías.

## 13. Cambios del chatbot

- Consulta el mismo catálogo público real: solo productos Yesera en las tres categorías habilitadas.
- Responde precio FZAC; no devuelve costo, proveedor, margen ni IDs internos.
- Stock 0 se comunica como `Consultar disponibilidad`, no como cantidad inventada.
- Mantiene historial acotado, saneamiento, longitud máxima, rate limiting, detección de prompt injection, fuentes internas y opciones rápidas.
- Se conservan estimación de placas, pagos, retiro/envío, devoluciones y handoff para casos críticos.

## 14. Pruebas del chatbot

- Clasificador: 140 documentos, 13 intents, 32 evaluaciones y 283 términos; check correcto.
- Smoke HTTP: saludo, cambio de tema a pago, cuenta, devolución, privacidad, compra, categorías, arrepentimiento, cálculo Durlock, cobro duplicado y prompt injection.
- Suite Playwright cubre orquestación, privacidad, fuentes, desktop y mobile.

## 15. Archivos modificados

- Datos/scripts: `scripts/catalog/*`, `data/imports/*`, `package.json`, `pnpm-lock.yaml`.
- Catálogo/Home: `lib/db/catalog.ts`, `components/catalog/*`, `components/home/home-page.tsx`, metadata públicas.
- PWA/chatbot: `public/icons/*`, `public/products/fzac/*`, `app/manifest.ts`, `app/icon.tsx`, `components/chatbot/floating-assistant.tsx`, estilos.
- Envío/deploy: `app/api/shipping/quote/route.ts`, `render.yaml`.
- QA: unitarias de importación y specs Playwright de navegación, catálogo, PWA y envío.

## 16. Migraciones realizadas

- `20260910131011_catalog_supplier_import_support.sql`: `supplier_id`, disponibilidad y tabla privada de procedencia/precio original.
- No se ejecutó SQL destructivo, no se borraron tablas y no se alteró Mercado Pago, Auth ni el contrato de RLS.
- La clasificación en las tres categorías y el renombre de proveedores se hicieron por script idempotente sobre filas existentes.

## 17. Resultado typecheck

- `pnpm typecheck`: correcto.
- Entorno local: Node 22.17.0 genera advertencia porque el repo declara mínimo 22.22.0; Render está fijado en 22.22.0.

## 18. Resultado build y seguridad

- `pnpm build`: correcto, 74 rutas.
- `pnpm lint`: correcto.
- `pnpm security:check`: correcto.
- `pnpm audit --prod`: 0 vulnerabilidades conocidas.

## 19. Resultado Playwright

- Corrida completa local sobre build productivo: 136 correctas, 49 omitidas y 0 fallos.
- Incluye las pruebas agregadas de catálogo/PWA (3) y cotización segura de envío (2).
- Los skips son escenarios condicionados por credenciales QA o productos con stock comprable; los 109 nuevos quedan intencionalmente en consulta.

## 20. Continuación UI/UX, seguridad y despliegue — 2026-09-13

- Catálogo final: 114 productos activos y 9 categorías. La auditoría automática quedó `READY`, sin slugs ni SKU duplicados.
- Productos históricos: `Clavos` se corrigió de Plomería a Ferretería usando su descripción existente como evidencia. `Clavos` y `Placa Drywall 12,5mm` siguen pendientes de una foto inequívoca; no se inventaron assets ni descripciones.
- Catálogo y detalle: carga progresiva 24/24, carruseles explícitos, galería ampliable, unidad junto al precio y mensajes diferenciados para `CONSULT`.
- Carrito/checkout: los productos a consultar no se presentan como stock validado; Maps fallido ofrece retiro `$0` o coordinación por WhatsApp y nunca habilita un flete inventado.
- Búsqueda verificada para durlock, placa(s), montante(s), solera(s), perfil(es), masilla, cinta, tornillo, cielorraso, pvc, lana de vidrio, PGU y PGC.
- Asistente: cinco consultas reales de catálogo, cálculo de pared, stock genérico e intento de prompt injection aprobados. Las variantes acentuadas también se bloquean.
- Seguridad: `product_supplier_sources` y `suppliers` conservan lectura exclusiva de admin; pedidos, items y pagos conservan owner/admin; eventos y auditoría son solo admin. El select público ya no serializa `supplier_id`.
- Leaked Password Protection permanece desactivado según Supabase Advisor. Debe habilitarse desde Auth settings si el plan Pro lo permite; no existe una operación segura disponible en el conector actual para cambiar esa opción.
- Envío automático permanece cerrado con HTTP `422` mientras falten `base`, precio/km, mínimo, redondeo y radio máximo aprobados. Fórmula sugerida, no activada: máximo entre mínimo y `base + km × precio/km`, redondeado hacia arriba.
- Validación local final: typecheck, ESLint, build, seguridad y 8 unit tests correctos; smoke del asistente 8/8; Playwright desktop 95 aprobados/27 omitidos; mobile 360 px 16 aprobados/6 omitidos; 0 fallos.
- El SHA y deploy definitivos se registran en el cierre posterior al push y la verificación explícita de Render.

## 21. Carrito y catálogo de Pinturas — 2026-09-13

### Carrito y compra

- Las cards y el detalle permiten añadir productos `CONSULT` al carrito sin presentarlos como stock confirmado.
- Éxito visible: `Producto añadido al carrito`; fallo visible y accesible: `El producto no se pudo añadir`.
- La cantidad de un producto a consultar puede ajustarse en carrito. El checkout y el backend continúan bloqueando `CONSULT`, `OUT_OF_STOCK` y stock 0.
- Si el carrito contiene artículos a consultar, la acción principal genera una consulta de WhatsApp con productos y cantidades; no habilita un pago falso.

### Vista previa y deduplicación de Universo

- Catálogo FZAC resultante: 1.770 productos activos (114 previos + 1.656 Pinturas).
- Fuente oficial inspeccionada: <https://www.tiendauniverso.com.ar/pinturas> y su catálogo público paginado.
- La fuente reportó 1.657 productos; 1.656 variantes tenían nombre, precio vigente, URL e imagen válidos. Una fila sin precio válido se excluyó.
- Vista previa antes de insertar: 1.656 nuevos, 0 actualizaciones, 0 recuperaciones y 0 duplicados contra FZAC.
- Auditoría posterior: 1.656 productos, 0 SKU duplicados, 0 slugs duplicados, 0 precios inválidos y 0 estados de disponibilidad incorrectos.
- No se tomó `AvailableQuantity` de VTEX porque puede ser un valor limitado por la plataforma. Los 1.656 productos quedaron con stock 0 y `CONSULT`.
- Como no existe una regla comercial de margen aprobada para Universo, el precio FZAC conserva el precio público vigente (`margin_percent = 0`). No se trasladaron precios de lista/promociones como ofertas FZAC.
- Rango de precios publicado e importado: ARS 49,05 a ARS 505.344,60. El costo/procedencia permanece fuera de las consultas públicas.
- Dataset: [`data/imports/universo-pinturas.preview.json`](../../data/imports/universo-pinturas.preview.json).

### Imágenes y proveedor

- Se creó/activó `Universo Pinturas SRL Rosario` (`UNIVERSO-PINTURAS-SRL`) sin inventar CUIT, contacto, domicilio ni condiciones comerciales.
- Se descargaron, validaron y optimizaron las 1.656 imágenes autorizadas a WebP (máximo 1000 px), y se guardaron bajo `product-images/universo-pinturas/`.
- Resultado de Storage: 1.656/1.656 imágenes propias, 0 hotlinks pendientes y 0 errores. La última corrida subió 1.525 y omitió correctamente 131 ya sincronizadas.
- Resultado detallado: [`data/imports/universo-pinturas-images.preview.json`](../../data/imports/universo-pinturas-images.preview.json).

### La Yesera, navegación y asistente

- La auditoría ahora recorre explícitamente Construcción en Seco y Steel Framing, además de complementos inequívocos Drywall/Durlock del catálogo.
- Resultado actual: 110 referencias públicas pertinentes —96 Construcción en Seco, 13 Steel Framing y 1 complemento—; todas ya existían por `source_product_id`. No se insertó ni actualizó ninguna y se conservaron 3 referencias históricas que ya no aparecen en la vista previa actual.
- Pintura e impermeabilización se habilitó como cuarto rubro público, con acceso desde Home, categorías, navegación, catálogo y buscador.
- El catálogo pagina 120 productos por vista y conserva filtros al avanzar/retroceder, evitando serializar más de 1.600 cards en una sola respuesta.
- El asistente carga el catálogo público completo por lotes, reconoce látex, esmaltes, barnices y aerosoles y sigue sin revelar proveedor, precio de referencia, margen ni IDs.

### Supabase y seguridad

- Migración aplicada: `20260913185058_allow_zero_margin_for_reference_pricing.sql`; amplía el check de procedencia a márgenes 0, 10 o 20 sin borrar datos.
- `product_supplier_sources` y `suppliers` continúan con RLS + FORCE RLS y lectura solo Admin. Productos públicos solo serializan campos comerciales.
- `orders`, `payments` y `profiles` conservan RLS owner/admin; el checkout vuelve a validar disponibilidad server-side.
- Leaked Password Protection sigue desactivado. El conector actual permite SQL/migraciones pero no `Auth Config`; la acción exacta pendiente es Dashboard → Authentication → Providers → Email → `Prevent use of leaked passwords`, disponible en plan Pro o superior.

### Validación de esta entrega

- Typecheck: correcto.
- Build productivo: correcto, 74 rutas.
- Seguridad local: correcto; secretos y 37 tablas con FORCE RLS validados.
- Unit tests: 10/10 correctos, incluyendo Universo sin precio, margen 0, stock no inferido y deduplicación.
- Playwright catálogo desktop: 25/25 correctos.
- Playwright seguridad y rutas sensibles: 24/24 correctos.
- Playwright carrito/detalle mobile Pixel 7: 3/3 correctos, sin scroll horizontal ni pago falso.
- Smoke del asistente: 7 consultas de catálogo, cálculo, stock y prompt injection correctos.
- Shipping no se modificó: retiro sigue en ARS 0 y delivery continúa cerrado con 422 mientras no exista una fórmula comercial aprobada.
