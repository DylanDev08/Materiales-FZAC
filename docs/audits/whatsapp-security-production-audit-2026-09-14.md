# Cierre de producción: WhatsApp, seguridad, catálogo y administración

Fecha: 14 de septiembre de 2026

Proyecto Supabase: `FZAC-Ecommerce` (`gooxgjzetziwnxhuymmx`)

Alcance: cambios mínimos, sin modificar productos, precios, stock, Auth, pagos ni la configuración del número de WhatsApp.

## Resumen ejecutivo

El canal vigente sigue siendo el **Meta Business Agent incluido en WhatsApp**, entrenado por el responsable de FZAC. No se migró el número, no se desconectó WhatsApp Business App y no se tocaron WABA, portfolio, app ni activos de Meta.

Se dejó preparada una integración propia con WhatsApp Cloud API para una etapa futura, pero queda cerrada por defecto: `WHATSAPP_BOT_ENABLED=false` y `WHATSAPP_BOT_DRY_RUN=true`. Solo debe activarse después de comprobar en la cuenta real que Meta ofrece coexistencia y después de una aprobación final.

También se corrigieron omisiones concretas: paginación completa del sitemap para 1.770 productos, control de duplicados y vista previa antes de guardar productos, exportación CSV segura de caja, estado operativo correcto para productos `CONSULT`, y una dependencia vulnerable de desarrollo.

## Entregables solicitados

1. **Arquitectura recomendada para WhatsApp.** Hoy: Meta Business Agent para respuestas básicas. Futuro opcional: cliente → Cloud API → `/api/whatsapp/webhook` → verificación de token/firma → parser acotado → reglas de seguridad/intención → consulta segura del catálogo FZAC → respuesta → registro mínimo en Supabase → derivación humana.
2. **Meta Business Agent vs. bot propio.** El agente actual alcanza para FAQ entrenadas y conserva el flujo operativo conocido. Un bot propio solo aporta valor cuando se necesiten precios/disponibilidad en vivo, enlaces del catálogo y lógica de pedidos. Por eso el agente actual se conserva y el bot propio queda preparado, no activo.
3. **Configuración futura en Meta.** Verificar elegibilidad de coexistencia del número; crear o reutilizar la app y WABA sin borrar activos; configurar callback HTTPS y verify token; suscribir `messages`; entregar credenciales mediante secretos de Render; validar permisos/token de sistema, versión Graph, número de prueba, handoff y baja segura. No ejecutar migración Cloud API-only sin coexistencia confirmada.
4. **Endpoints.** Se agregó `GET /api/whatsapp/webhook` para `hub.challenge` y `POST /api/whatsapp/webhook` para eventos firmados. El POST limita cuerpo a 256 KiB, aplica rate limit, exige `x-hub-signature-256`, valida payload y deduplica el identificador del mensaje.
5. **Variables.** `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_HUMAN_HANDOFF_NUMBER`, `WHATSAPP_BOT_ENABLED` y `WHATSAPP_BOT_DRY_RUN`. No hay valores secretos versionados.
6. **Tablas.** Se reutilizaron `chat_conversations` y `chat_messages`. Se añadieron solo `phone_hash`, `phone_last4`, `external_message_id`, `direction` y `message_type`, más índices de deduplicación/correlación. No se crearon tablas duplicadas.
7. **Cambios reales.** Webhook seguro; parser, firma HMAC, hash telefónico, cliente con timeout, responder basado en catálogo real, persistencia y handoff; preview/deduplicación administrativa; CSV de caja; sitemap paginado; estado de sistema; hardening RLS/grants; tests; override de `js-yaml` 4.3.2.
8. **Cambios propuestos, no activados.** Alta/configuración Cloud API, coexistencia, secretos reales, envío de mensajes, asociación autenticada de número con cliente/pedido y tarifa comercial de delivery.
9. **Seguridad revisada.** Secretos server-side, mutaciones admin, checkout, búsqueda, asistente, firma de webhooks, límites de cuerpo, rate limiting, sanitización, CSP/headers, RLS, exposición de costos y dependencias.
10. **Vulnerabilidades encontradas.** `js-yaml` 4.3.1 transitivo de ESLint (alta); Leaked Password Protection desactivada; `is_admin()` SECURITY DEFINER ejecutable por `authenticated`; `_prisma_migrations` con RLS sin policy informativa; deuda de performance en índices/policies. No se encontró un secreto nuevo versionado.
11. **Vulnerabilidades corregidas.** `js-yaml` fijado en 4.3.2; tablas de chat con FORCE RLS, sin privilegios para `anon` y solo `SELECT` para `authenticated`; escrituras de WhatsApp solo mediante backend service-role; message id único; firma obligatoria; teléfono completo no persistido.
12. **UI/UX revisada.** Home, catálogo, búsqueda, detalle, carrito, checkout, autenticación, 404, panel admin y flotantes. Los flujos existentes ya cubren cards, carrusel, consulta y fallback; no se hizo un rediseño riesgoso.
13. **UI/UX corregida.** Vista previa comercial completa al cargar/editar producto, aviso preventivo de duplicado y exportación visible de caja. El sitemap dejó de truncar el catálogo.
14. **Mobile revisado.** Se probaron iPhone 13, Pixel 7 y dos viewports compactos de 360 px. Navegación, catálogo, detalle, carrito, login, registro y bloqueo admin anónimo pasaron sin overflow.
15. **Mobile corregido.** No surgió un defecto nuevo reproducible que justificara tocar estilos públicos. Se mantuvieron los tamaños táctiles y los fallbacks existentes.
16. **Productos revisados.** Auditoría remota en modo lectura: 1.770 totales, 1.770 activos, 9 categorías activas, sin slugs ni SKU duplicados y sin imágenes en host no permitido.
17. **Carga de productos mejorada.** Preview antes de guardar y bloqueo duplicado por SKU, slug o nombre normalizado tanto en cliente como en API admin. La API recorre el catálogo completo por páginas; no confía solo en el navegador.
18. **Ingresos y egresos revisados.** La implementación existente ya separa movimientos reales de proyecciones y consolida períodos. Se añadió exportación CSV de las filas visibles con escape de comillas y protección contra fórmulas maliciosas.
19. **Admin simplificado.** Se conservaron sus secciones existentes y se mejoraron dos tareas frecuentes sin agregar otra pantalla: validar visualmente un producto antes de guardarlo y exportar caja.
20. **APIs protegidas.** Los tests confirman bloqueo anónimo de APIs admin, control de origen en mutaciones, endpoint de arrepentimiento acotado, checkout anónimo sin escritura y webhook de Mercado Pago con barrera productiva.
21. **SQL injection revisado.** La integración nueva usa Supabase Query Builder con datos validados; no ejecuta SQL generado por mensajes. Las búsquedas/intenciones no interpolan SQL crudo.
22. **RLS revisado.** `chat_conversations` y `chat_messages` tienen RLS y FORCE RLS activos. La lectura autenticada sigue filtrada por las policies dueño/admin existentes; filas WhatsApp sin `user_id` quedan fuera del usuario común. `anon` no tiene privilegios.
23. **Checkout revisado.** Sigue bloqueando cobro de `CONSULT`, `OUT_OF_STOCK` o stock no comprable en servidor. Un producto `CONSULT` puede guardarse en carrito consultivo, pero exige confirmación antes del pago.
24. **Estabilidad/sostenibilidad.** WhatsApp usa timeout de 7 s, body máximo, rate limit, Graph host fijo y modo apagado/dry-run. Catálogo/sitemap y panel consultan por páginas. El error de Maps permanece fail-closed y no habilita un cobro ficticio.
25. **Tests ejecutados.** Install congelado, TypeScript, ESLint, build, seguridad, unitarios, auditoría de catálogo, audit de dependencias, Playwright desktop y Playwright mobile.
26. **Resultados.** Typecheck OK; ESLint OK; build OK (75 rutas); security check OK (37 tablas públicas con FORCE RLS); unitarios 10/10; catálogo READY con 6 hallazgos; dependencias 0 vulnerabilidades conocidas después del fix; Playwright desktop 104 passed/26 skipped; mobile 78 passed/10 skipped; webhook local: challenge correcto 200, token/firma incorrectos 401 y evento firmado con bot apagado 200 sin persistencia/envío.
27. **Archivos modificados.** Ver el commit de cierre. Principales: `app/api/whatsapp/webhook/route.ts`, `lib/whatsapp/*`, `lib/products/identity.ts`, API/formulario admin de productos, gestor financiero, sitemap, estado/health, estilos admin, tipos, `render.yaml`, `.env.example`, migraciones, tests y reportes.
28. **Migraciones.** `20260914030407_whatsapp_existing_chat_channel.sql` y `20260914032359_whatsapp_chat_grants_hardening.sql`, aplicadas y verificadas en el proyecto correcto. En remoto figuran como `20260914031615` y `20260914032417` por la marca temporal del servidor.
29. **Commits.** Se completa al cerrar esta entrega.
30. **Deploy Render.** Se completa solo después del push y de comprobar HTTP, rutas y SHA efectivo.
31. **SHA final.** Se completa solo después de que Render sirva el commit nuevo.
32. **Pendientes reales.** Activar Leaked Password Protection; decidir dominio final/SEO; completar 2 fotos reales, 113 descripciones débiles, 9 imágenes de rubro y resolver 4 rubros vacíos con fuente válida; definir tarifa real de envío; verificar coexistencia Meta; configurar secretos y pruebas con número sandbox antes de considerar el bot propio.

## Supabase: hallazgos que no deben maquillarse

- **Leaked Password Protection:** sigue desactivada. En Supabase Dashboard abrir `Authentication` → `Providers` → `Email` → activar `Prevent use of leaked passwords`. Requiere plan Pro o superior. Afecta altas/cambios de contraseña; usuarios existentes no quedan bloqueados automáticamente.
- **`public.is_admin()`:** el advisor advierte que `authenticated` puede ejecutar una función SECURITY DEFINER. La función participa en RLS actual; revocar a ciegas podría romper autorizaciones. Debe migrarse con pruebas de policies antes de cambiar el grant.
- **`_prisma_migrations`:** RLS sin policy es informativo y mantiene la tabla inaccesible desde clientes; no necesita una policy pública.
- **Performance:** hay FKs sin índice, dos advertencias `auth` initplan y policies permisivas superpuestas. Requieren benchmark/migración separada; no justifican un cambio masivo en este cierre.

## Catálogo: pendientes con integridad de datos

- Sin foto/placeholder: `Clavos (20003)` y `Placa Drywall 12,5mm (FZAC-DRY-125)`.
- Descripción débil: 113 productos. Solo completar desde ficha/fuente autorizada.
- Rubros sin productos activos: Herramientas, Electricidad, Plomería y Revestimientos. Ocultarlos o poblarlos exige decisión comercial; no se inventaron ítems.
- Stock visible total: 120. Los productos importados `CONSULT` con stock 0 se consideran consultables, no “sin stock” ni comprables.

## Google Maps y envío

La API existente valida la dirección, aplica rate limit y devuelve `422` cuando no están configuradas key y tarifa completas. Retiro sigue en $0. Las variables esperadas están preparadas, pero la fórmula comercial no se activó ni se dedujo desde otra tienda. Faltan valores aprobados de base, precio/km, mínimo, redondeo y radio máximo.

## Criterio operativo sobre el agente de Meta

No configurar el webhook propio sobre el número actual únicamente porque el código existe. Antes hay que comprobar la opción de coexistencia dentro del onboarding disponible para la cuenta FZAC. Si no aparece, continuar con el Meta Business Agent y atención manual; migrar a Cloud API-only podría afectar el uso cotidiano del jefe.
