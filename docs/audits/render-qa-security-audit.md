# Auditoria QA, seguridad y pagos - Materiales FZAC

- Fecha: 2026-07-22
- URL auditada: https://materiales-fzac-8xmp.onrender.com/
- Rama: `main`
- Entorno auditado: Render + build local Next.js
- Alcance: QA smoke, rutas, checkout, idempotencia, Mercado Pago, Supabase/RLS por codigo/migraciones, APIs, legal, UX, mobile, headers y accesibilidad basica.

## Variables requeridas

Sin valores sensibles:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` solo servidor
- `DATABASE_URL`
- `DIRECT_URL`
- `ADMIN_EMAILS`
- `PAYMENTS_ENABLED`
- `PAYMENTS_ENV`
- `PAYMENTS_PROVIDER`
- `MERCADOPAGO_ACCESS_TOKEN` solo servidor
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_CHECKOUT_PRO_ACCESS_TOKEN` opcional, solo servidor
- `NEXT_PUBLIC_MERCADOPAGO_CHECKOUT_PRO_PUBLIC_KEY` opcional
- `MERCADOPAGO_CARD_ACCESS_TOKEN` opcional, solo servidor
- `NEXT_PUBLIC_MERCADOPAGO_CARD_PUBLIC_KEY` opcional
- `MERCADOPAGO_WEBHOOK_SECRET`
- `PURCHASE_AUTO_APPROVAL_LIMIT`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- Variables de email/Resend cuando se active constancia automatica

## Baseline local

| Comando | Estado | Evidencia |
| --- | --- | --- |
| `npm run typecheck` | OK | TypeScript completo sin errores antes de cambios. |
| `npm run build` | OK | Build Next.js 16.2.11 completo con Node 22.22.0 y 59 rutas. |
| `npm audit` | OK | Next y `eslint-config-next` se actualizaron a `16.2.11`; quedan 0 vulnerabilidades reportadas. |

## Actualizacion de integridad transaccional - 2026-07-22

Se contrasto el codigo con el esquema real de Supabase mediante consultas de solo lectura y pruebas transaccionales con rollback. Los cambios de esquema se aplicaron como migraciones versionadas y no se eliminaron datos existentes.

| Control | Estado real | Evidencia |
| --- | --- | --- |
| Creacion de checkout | Corregido | La RPC `create_checkout_order` guarda orden, items y pago dentro de una unica transaccion. Ante cualquier error se revierte todo. |
| Idempotencia concurrente | Protegida | Indice unico parcial sobre `payments(provider_session_id)` y recuperacion de la misma orden ante retries. Dos conexiones concurrentes devolvieron un solo pedido/pago. |
| Vinculo de idempotencia | Protegido | La huella incluye usuario, email, carrito, entrega, metodo y datos relevantes. Reutilizar la clave con otro intento devuelve conflicto. |
| Precio y stock | Protegidos | La RPC bloquea los productos, relee precio/stock y valida subtotal antes de persistir. Lineas duplicadas del carrito se agregan por producto. |
| Finalizacion de pago | Protegida | Prueba con rollback confirmo un solo descuento de stock, ticket y movimiento ante eventos repetidos. |
| Webhook | Reforzado | Valida monto, moneda, entorno y asociacion local. Contracargos se tratan como reembolso y reembolsos parciales pasan a revision manual. |
| Privilegios de perfil | Protegidos | Trigger de base impide que un usuario cambie `role`, `email` o `id`; se verifico tambien el contexto real de `service_role` de PostgREST. |
| Observabilidad | Activa | La consola de sistema consulta integridad de checkout, indice de idempotencia, privilegios, stock negativo y pedidos incompletos. |
| Solicitudes del consumidor | Protegidas | Alta server-side con idempotencia, RLS de lectura propia, gestión admin, auditoría, notificaciones y constancias Resend sin reembolso automático. |

### Hallazgo historico preservado

Se detectaron **63 ordenes historicas sin items**. El origen era un contrato desalineado: la aplicacion insertaba `price`, pero la tabla real exige `unit_price` y `subtotal`, y el error de insercion se ignoraba. Los nuevos pedidos ya no pueden quedar en ese estado porque se crean de forma atomica. Los 63 registros se conservaron para auditoria; su conciliacion o anulacion requiere una decision administrativa y no se automatizo.

### Seguridad de la suite QA

Las pruebas normales de Playwright ya no crean pedidos. Los casos que escriben en checkout quedan salteados salvo que se habiliten deliberadamente con una sesion QA autenticada, email y producto QA. Los destinos remotos requieren ademas una confirmacion separada (`QA_ALLOW_REMOTE_WRITES=true`).

## Resultado por area

| Area | Estado | Riesgo | Evidencia | Accion tomada | Pendiente |
| --- | --- | --- | --- | --- | --- |
| Deploy Render | Pendiente de este lote | Bajo | La versión previa estable publicaba `a566651`; el deploy final debe coincidir con `main` en `/api/health`. | Build y suites locales completos antes del push. | Verificar SHA y smoke remoto al terminar el deploy. |
| Home | OK | Bajo | Carga sin 404/500 en Render. | Se agrego acceso visible al Boton de arrepentimiento en el bloque legal del home. | Revisar copy legal con profesional. |
| Productos | OK | Bajo | `/productos` responde 200 y permite agregar producto al carrito en smoke local/Render. | Suite E2E cubre agregado y paso a checkout. | Mantener monitoreo de imagenes externas. |
| Detalle producto | OK | Bajo | Las rutas `/producto/[slug]` compilan y Render muestra actividad de rutas. | Sin cambios. | Agregar test especifico por slug en una siguiente iteracion. |
| Carrito | OK | Bajo | `/carrito` carga y muestra accion a checkout luego de agregar producto. | Test E2E agregado. | Validar mas casos de cantidad en mobile. |
| Checkout | OK con observaciones | Medio | API recalcula productos/stock en backend y diferencia `MERCADOPAGO`, `BANK_TRANSFER`, `WHATSAPP`. | Test E2E/API cubre transferencia, WhatsApp y Mercado Pago test. | No hacer compras reales; verificar cada deploy con comprador TESTUSER. |
| Idempotencia | Protegida | Bajo | La base real tiene indice unico parcial y RPC atomica; no hay claves duplicadas. | Se probo retry y concurrencia desde dos conexiones: una sola orden, item y pago. | Mantener monitoreo en Admin > Sistema. |
| Mercado Pago | OK con control de entorno | Medio | `PAYMENTS_ENV=test` usa `sandbox_init_point || init_point`; webhook valida `live_mode`. | Test API espera `sandbox_init_point` en modo test. | No mezclar vendedor real/comprador real con credenciales de prueba; usar comprador TESTUSER. |
| Webhook | Reforzado | Bajo | Valida firma con comparación temporal segura, `live_mode`, asociación, monto y moneda; no confía en el payload para confirmar. | Se aisló la validación HMAC y se cubrieron ausencia de secret, firma inválida y firma válida. | Mantener pruebas con eventos sandbox antes de pasar a producción. |
| Transferencia | OK | Bajo | `BANK_TRANSFER` crea pedido pendiente y no devuelve `redirect_url`. | Test API agregado. | Flujo administrativo de envio de datos bancarios depende de operacion FZAC/email. |
| WhatsApp | OK | Bajo | `WHATSAPP` crea pedido pendiente, no devuelve MP y genera `whatsapp_url`. | Test API agregado. | Validar numero final en Render. |
| Base de datos | Auditada | Bajo/Medio | Se consultó el esquema real, constraints, RLS e integridad sin borrar datos. Las migraciones `20260722000000` a `20260722050000` quedaron registradas remotamente. | Se corrigió checkout atómico y se completó el flujo privado de solicitudes del consumidor. | Conciliar las 63 órdenes históricas incompletas con decisión administrativa. |
| RLS | Activa y reforzada | Bajo/Medio | RLS esta habilitada en las tablas publicas revisadas. El trigger real preserva `id`, `email` y `role` ante escrituras de clientes. | Se probo con rollback que un usuario no puede elevarse a ADMIN. | La auditoria de policies debe repetirse ante cada cambio de esquema. |
| Admin | OK | Bajo | APIs admin anonimas devuelven 401; `/admin` redirige a consola oculta. | Se verificaron `/api/admin/*` anonimos. | Probar usuario comun autenticado vs admin real en navegador. |
| Rutas protegidas | OK | Bajo | `/api/admin/metrics`, orders, payments, products devuelven 401 anonimo; `/api/orders/:id` devuelve 401 anonimo. | Reportado. | Test automatizado autenticado requiere credenciales de QA separadas. |
| Botones | OK | Bajo | Playwright recorrio los links internos principales en Render sin 404. | `/register` redirige a `/registro` y `/arrepentimiento` esta publicado. | Repetir el smoke ante cambios de navegacion. |
| Legal consumidor | Completo técnicamente | Bajo/Medio | `/arrepentimiento` registra un trámite idempotente, genera número, avisa al admin y envía constancia cuando Resend está disponible. | Se agregó gestión de estados, nota de resolución y seguimiento autenticado en Mi cuenta. | Revisión jurídica final por profesional antes de producción. |
| Botón arrepentimiento | Operativo | Bajo/Medio | Formulario mobile con validación, honeypot, rate limit, idempotencia y contenido seguro. | El cliente conserva número y puede consultar estado; el admin gestiona desde una sección dedicada. | Definir SLA interno de respuesta y responsables. |
| Reembolsos | OK con migracion | Medio | Endpoint admin exige admin, motivo, pago PAID, MP, live_mode compatible y RPC de integridad. | Auditado. | Confirmar migracion `finalize_refunded_order` aplicada en Supabase. |
| Seguridad headers | Reforzada | Bajo | Incluye `DENY`, `nosniff`, HSTS, referrer/permissions policy, COOP/CORP y cache privada en rutas sensibles. | Se agregó CSP Report-Only compatible con Supabase, Google y Mercado Pago, más colector acotado y rate-limited. | Revisar reportes reales antes de convertir CSP a modo obligatorio. |
| Performance | Basico OK | Bajo | Build optimizado compila; no se ejecuto Lighthouse completo. | Documentado. | Medir Lighthouse tras deploy final. |
| Mobile | OK local | Bajo | iPhone 13, Pixel 7, Galaxy S20 y 360x740 pasan rutas, overflow, menú, catálogo, producto, carrito, legal y auth. | 68 pruebas pasaron; 4 casos autenticados quedaron omitidos deliberadamente. | Repetir smoke contra Render después del deploy. |
| Auth y enumeración | Reforzada | Bajo | Login conserva respuesta genérica; recuperación y comprobación pública no revelan si existe una cuenta. | Registro duplicado devuelve respuesta neutral, el dominio configurado prevalece sobre Host y `next` solo acepta rutas internas seguras. | Probar entrega real de email al rotar dominio/Resend. |
| Accesibilidad | Parcial | Medio | Smoke valida rutas y botones principales, no axe completo. | Documentado. | Agregar auditoria axe si se permite instalar dependencia adicional. |

## Bugs corregidos en esta rama

1. `/register` desplegado respondia 404. Se agrego redirect compatible hacia `/registro`.
2. `/arrepentimiento` desplegado respondia 404. Se agrego la ruta publica con identidad FZAC.
3. Faltaba acceso directo visible al Boton de arrepentimiento desde home/footer. Se agregaron links visibles.
4. Las pruebas API de Playwright corrian en desktop y mobile, disparando rate limit 429. Se limitaron a desktop para evitar ruido y no generar requests duplicados.
5. Faltaba HSTS en produccion. Se agrego header en `proxy.ts`.
6. La creacion de orden, items y pago no era transaccional y ocultaba el error de `order_items.price`. Se reemplazo por una RPC atomica con validacion de precio/stock.
7. La idempotencia no estaba protegida contra concurrencia real. Se agrego indice unico parcial, huella del intento y recuperacion segura.
8. El perfil permitia intentar modificar el rol desde el cliente. Se agrego un guard de base probado contra PostgREST.
9. El webhook no conciliaba monto/moneda ni contracargos. Ahora rechaza inconsistencias y deriva reembolsos parciales a revision.
10. `next@16.2.10` quedo afectado por avisos de seguridad. Se actualizo junto con el lockfile a `16.2.11`.
11. El Botón de arrepentimiento no persistía solicitudes. Ahora registra un único trámite por intento, entrega constancia y permite gestión administrativa.
12. El cliente no tenía seguimiento de solicitudes. Se agregó `/cuenta/solicitudes`, limitado a su identidad y email.
13. El registro revelaba cuentas existentes. Ahora usa una respuesta indistinguible y el endpoint público de comprobación no devuelve existencia.
14. Faltaba CSP progresiva y bloqueo transversal de mutaciones cross-site. Se incorporaron sin imponer una política que pudiera romper OAuth o pagos.
15. Los enlaces de auth podían tomar un Host reenviado no confiable y `next=/\\dominio` podía escapar del sitio. Se fijó origen canónico y normalización compartida de rutas internas.

## Hallazgos de seguridad

- `SUPABASE_SERVICE_ROLE_KEY` esta centralizada en modulos `server-only` y no aparece en componentes cliente.
- `MERCADOPAGO_ACCESS_TOKEN` se consume desde modulos server-side de pagos/config y no desde componentes cliente.
- Los endpoints admin revisados devuelven 401 a anonimos.
- El webhook de Mercado Pago no queda fail-open en produccion sin secret.
- Los logs de Mercado Pago estan condicionados a no-production y sanitizan contexto.
- Las migraciones nuevas de checkout atomico, idempotencia, observabilidad y profile guard figuran en el historial remoto de Supabase.
- Las solicitudes del consumidor se escriben únicamente desde backend, tienen idempotencia en base y RLS de lectura propia/administración.
- Las mutaciones API de navegador rechazan origen cruzado, salvo los aliases explícitos del webhook externo de Mercado Pago.
- La comprobación pública y el alta duplicada no permiten enumerar cuentas.
- Existen 63 ordenes historicas sin items. No se eliminaron ni editaron automaticamente para preservar trazabilidad.

## Playwright

Suite creada: `tests/e2e/render-smoke.spec.ts`.

Primera corrida contra Render actual:

- 28 pruebas OK.
- 8 fallas:
  - `/register` 404 desktop/mobile.
  - `/arrepentimiento` 404 desktop/mobile.
  - Validacion de toast de carrito demasiado estricta desktop/mobile.
  - API checkout en mobile duplicaba las pruebas de desktop y chocaba con rate limit 429.

Acciones tomadas:

- Redirect `/register -> /registro`.
- Nueva pagina `/arrepentimiento`.
- Test de carrito ajustado a flujo real: agregar, abrir carrito, continuar a checkout.
- API checkout limitada a desktop para no disparar rate limit.

Corrida final contra build local en `http://localhost:3100`:

- Smoke desktop: 15 OK, 4 salteadas por requerir escritura QA, 0 fallas.
- Suite mobile: 68 OK, 22 salteadas por ser desktop o requerir sesion QA, 0 fallas.
- Los tests con escritura requieren habilitacion explicita y nunca corren por defecto contra Render.

Control previo estable contra `https://materiales-fzac-8xmp.onrender.com/`:

- Render sirve el SHA completo `626224438f3115afe770eb5c0416e3643773c665`.
- Smoke desktop: 15 OK, 4 salteadas por requerir escritura QA, 0 fallas.
- Mobile 360x740: 17 OK, 1 salteada por requerir sesion QA, 0 fallas.
- No se realizaron pagos, pedidos ni escrituras productivas durante este control.

Control local del lote actual:

- Seguridad: 11 OK, 0 fallas.
- Smoke desktop: 15 OK, 4 salteadas por requerir escritura QA.
- Mobile: 68 OK, 4 salteadas por requerir sesión QA.
- Concurrencia de solo lectura: 100 búsquedas y 80 validaciones de carrito, sin 500; los límites devolvieron 429 con `Retry-After`.
- Flujo legal controlado: creación 201, replay idempotente 200, contenido hostil 422 y limpieza posterior de los datos QA.

## Validacion final local

| Comando | Estado |
| --- | --- |
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| Build con Node `22.22.0` | OK, 59 rutas |
| `npm audit --omit=dev` | OK, 0 vulnerabilidades |
| Smoke Playwright desktop | OK, 15 passed / 4 skipped |
| Playwright seguridad | OK, 11 passed |
| Playwright mobile | OK, 68 passed / 4 skipped |
| Smoke de concurrencia | OK, 180 requests / 0 respuestas 500 |

## Estabilizacion de carga en Render

Durante la verificacion del lote se detecto un fallo intermitente de hidratacion exclusivo del transporte de Render:

- El HTML principal respondia `200`, pero Chromium recibia `ERR_HTTP2_SERVER_REFUSED_STREAM` o `ERR_QUIC_PROTOCOL_ERROR` al solicitar algunos chunks propios de `/_next/static`.
- `/productos` iniciaba 51 prefetches RSC especulativos antes de cualquier interaccion, ademas de los recursos necesarios para hidratar la pagina.
- Se desactivo `prefetch` en enlaces repetidos de catalogo, productos, navegacion y footer. La navegacion cliente sigue funcionando al hacer click.
- El build de produccion se fijo en Webpack para usar el empaquetado mas estable en el runtime de Render.

Medicion local sobre el artefacto final:

- Antes: 51 solicitudes RSC especulativas y 47 solicitudes abortadas en la muestra.
- Despues: 0 solicitudes RSC especulativas, 0 solicitudes fallidas y 3/3 productos hidratados con su accion Agregar.
- Instalacion limpia equivalente a Render: `npm ci --include=dev` OK.
- Build Node `22.22.0` + Webpack: OK, 59 rutas.
- Seguridad: 11 passed.
- Smoke desktop: 15 passed / 4 skipped por escritura QA deshabilitada.
- Mobile completo: 68 passed / 22 skipped por proyecto desktop o sesion QA ausente.

## TODOs pendientes antes de produccion

1. Conciliar administrativamente las 63 ordenes historicas sin items; no reconstruirlas sin evidencia.
2. Revisar legalmente términos, privacidad, devoluciones y SLA del Botón de arrepentimiento antes del lanzamiento definitivo.
3. Analizar reportes CSP de Render y recién después evaluar pasar de Report-Only a enforcement.
4. Agregar casos integrados del webhook approved/rejected/refunded con fixtures del proveedor, sin usar cobros reales.
5. Probar usuario normal autenticado bloqueado en admin y admin autorizado con cuentas QA separadas.
6. Probar Mercado Pago solo con comprador TESTUSER y credenciales del mismo entorno.
