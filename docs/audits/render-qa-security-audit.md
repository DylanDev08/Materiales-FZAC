# Auditoria QA, seguridad y pagos - Materiales FZAC

- Fecha: 2026-07-21
- URL auditada: https://materiales-fzac-8xmp.onrender.com/
- Rama: `audit-hardening-render-fzac`
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
| `npm run build` | OK | Build Next.js completo con 56 rutas. |
| `npm audit` | OK luego de fix | Se instalo Playwright y se aplico `npm audit fix`; quedan 0 vulnerabilidades reportadas. |

## Resultado por area

| Area | Estado | Riesgo | Evidencia | Accion tomada | Pendiente |
| --- | --- | --- | --- | --- | --- |
| Deploy Render | Parcial | Medio | Render responde 200 en `/` y `/productos`; `/admin` redirige 307 a ruta oculta. | Se audito URL actual. | Desplegar esta rama para que Render tome `/arrepentimiento` y `/register`. |
| Home | OK | Bajo | Carga sin 404/500 en Render. | Se agrego acceso visible al Boton de arrepentimiento en el bloque legal del home. | Revisar copy legal con profesional. |
| Productos | OK | Bajo | `/productos` responde 200 y permite agregar producto al carrito en smoke local/Render. | Suite E2E cubre agregado y paso a checkout. | Mantener monitoreo de imagenes externas. |
| Detalle producto | OK | Bajo | Las rutas `/producto/[slug]` compilan y Render muestra actividad de rutas. | Sin cambios. | Agregar test especifico por slug en una siguiente iteracion. |
| Carrito | OK | Bajo | `/carrito` carga y muestra accion a checkout luego de agregar producto. | Test E2E agregado. | Validar mas casos de cantidad en mobile. |
| Checkout | OK con observaciones | Medio | API recalcula productos/stock en backend y diferencia `MERCADOPAGO`, `BANK_TRANSFER`, `WHATSAPP`. | Test E2E/API cubre transferencia, WhatsApp y Mercado Pago test. | No hacer compras reales; verificar cada deploy con comprador TESTUSER. |
| Idempotencia | OK aplicacion / Medio DB | Medio | `createCheckout` busca `provider_session_id` antes de crear; migracion segura `payments_provider_session_unique_idx` existe. | Test API con misma `idempotency_key` espera mismo `order_id/payment_id`. | Confirmar que la migracion este aplicada en Supabase productivo; si hay duplicados, limpiarlos antes del indice. |
| Mercado Pago | OK con control de entorno | Medio | `PAYMENTS_ENV=test` usa `sandbox_init_point || init_point`; webhook valida `live_mode`. | Test API espera `sandbox_init_point` en modo test. | No mezclar vendedor real/comprador real con credenciales de prueba; usar comprador TESTUSER. |
| Webhook | OK | Bajo/Medio | Valida firma con `x-signature`, `x-request-id`, HMAC y `timingSafeEqual`; en production sin secret rechaza. | Se reviso `mercadopago-webhook.ts`. | Agregar tests unitarios especificos de firma/live_mode en proxima iteracion. |
| Transferencia | OK | Bajo | `BANK_TRANSFER` crea pedido pendiente y no devuelve `redirect_url`. | Test API agregado. | Flujo administrativo de envio de datos bancarios depende de operacion FZAC/email. |
| WhatsApp | OK | Bajo | `WHATSAPP` crea pedido pendiente, no devuelve MP y genera `whatsapp_url`. | Test API agregado. | Validar numero final en Render. |
| Base de datos | Parcial auditada | Medio | Migraciones revisadas: idempotencia, guard de perfil, finalize paid/refund. | Documentado. | No se consulto `pg_policies` directo para no tocar Supabase sin necesidad; recomendable ejecutar auditoria SQL read-only. |
| RLS | Parcial auditada | Medio | Migracion `protect_profile_security_fields` bloquea cambios de `role/email/id` por usuarios no service role. | Se verifico mitigacion en migracion. | Confirmar en Supabase que la migracion esta aplicada y RLS esta enabled en todas las tablas sensibles. |
| Admin | OK | Bajo | APIs admin anonimas devuelven 401; `/admin` redirige a consola oculta. | Se verificaron `/api/admin/*` anonimos. | Probar usuario comun autenticado vs admin real en navegador. |
| Rutas protegidas | OK | Bajo | `/api/admin/metrics`, orders, payments, products devuelven 401 anonimo; `/api/orders/:id` devuelve 401 anonimo. | Reportado. | Test automatizado autenticado requiere credenciales de QA separadas. |
| Botones | Parcial | Medio | Playwright recorrio hasta 25 links internos principales; detecto 404 en `/register` y `/arrepentimiento` desplegados. | Se agrego redirect `/register -> /registro` y ruta `/arrepentimiento`. | Repetir tras deploy para confirmar cero 404. |
| Legal consumidor | Mejorado | Medio | Render no tenia `/arrepentimiento` directo. | Se agrego pagina y links visibles en home/footer. | Falta formulario persistente con numero de tramite y constancia email. |
| Boton arrepentimiento | Mejorado | Medio | Antes 404 en Render. | Nueva ruta `/arrepentimiento`, CTA legal en home y footer. | Backend de tramite pendiente si se requiere cumplimiento formal completo. |
| Reembolsos | OK con migracion | Medio | Endpoint admin exige admin, motivo, pago PAID, MP, live_mode compatible y RPC de integridad. | Auditado. | Confirmar migracion `finalize_refunded_order` aplicada en Supabase. |
| Seguridad headers | Mejorado | Bajo/Medio | Render ya tenia `DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; faltaba HSTS. | Se agrego `Strict-Transport-Security` en produccion. | CSP queda pendiente para no romper Supabase/Mercado Pago sin validacion completa. |
| Performance | Basico OK | Bajo | Build optimizado compila; no se ejecuto Lighthouse completo. | Documentado. | Medir Lighthouse tras deploy final. |
| Mobile | Parcial | Medio | Suite Playwright incluye Pixel 7; detecto las mismas rutas 404 pendientes de deploy. | Suite agregada. | Repetir full suite contra Render actualizado. |
| Accesibilidad | Parcial | Medio | Smoke valida rutas y botones principales, no axe completo. | Documentado. | Agregar auditoria axe si se permite instalar dependencia adicional. |

## Bugs corregidos en esta rama

1. `/register` desplegado respondia 404. Se agrego redirect compatible hacia `/registro`.
2. `/arrepentimiento` desplegado respondia 404. Se agrego la ruta publica con identidad FZAC.
3. Faltaba acceso directo visible al Boton de arrepentimiento desde home/footer. Se agregaron links visibles.
4. Las pruebas API de Playwright corrian en desktop y mobile, disparando rate limit 429. Se limitaron a desktop para evitar ruido y no generar requests duplicados.
5. Faltaba HSTS en produccion. Se agrego header en `proxy.ts`.

## Hallazgos de seguridad

- `SUPABASE_SERVICE_ROLE_KEY` esta centralizada en modulos `server-only` y no aparece en componentes cliente.
- `MERCADOPAGO_ACCESS_TOKEN` se consume desde modulos server-side de pagos/config y no desde componentes cliente.
- Los endpoints admin revisados devuelven 401 a anonimos.
- El webhook de Mercado Pago no queda fail-open en produccion sin secret.
- Los logs de Mercado Pago estan condicionados a no-production y sanitizan contexto.
- Riesgo pendiente: confirmar en Supabase que las migraciones de idempotencia, profile guard, finalize paid/refund estan aplicadas. El repo contiene migraciones seguras, pero el estado real de DB debe verificarse desde el panel/SQL read-only.

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

- 32 pruebas OK.
- 4 pruebas salteadas intencionalmente: las pruebas API en mobile no corren para evitar duplicar pedidos/reintentos y chocar contra rate limits.
- 0 fallas.

## Validacion final local

| Comando | Estado |
| --- | --- |
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run build` | OK |
| `npm audit --omit=dev` | OK, 0 vulnerabilidades |
| `BASE_URL=http://localhost:3100 npx playwright test` | OK, 32 passed / 4 skipped |

## TODOs pendientes antes de produccion

1. Desplegar la rama y repetir `npm run test:e2e` contra Render actualizado.
2. Confirmar en Supabase, con consultas read-only, RLS enabled y policies efectivas en tablas sensibles.
3. Confirmar migracion `payments_provider_session_unique_idx` aplicada.
4. Implementar tramite persistente del Boton de arrepentimiento si se exige constancia automatica: tabla/request, notificacion admin y email.
5. Agregar CSP progresiva validada con Mercado Pago, Supabase, Google OAuth y assets.
6. Agregar tests unitarios del webhook: firma invalida, sin secret en production, live_mode incompatible, approved/rejected/refunded.
7. Probar usuario normal autenticado bloqueado en admin y admin autorizado.
8. Probar Mercado Pago solo con comprador TESTUSER y credenciales del mismo entorno.
