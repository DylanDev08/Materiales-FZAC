# Auditoría final previa a pagos reales — 2026-09-25

## Decisión

**BLOCKED** para el smoke test real. El código auditado no tiene Critical/High conocidos, pero todavía hay dos bloqueos operativos verificables:

1. El hardening de esta auditoría está en la rama `release/final-production-audit-20260924`, no en el SHA productivo `f18fed87e46d0c2aee671fef87f1444971bb821a`.
2. La Public Key productiva no existe en el entorno local auditado y las integraciones disponibles no permiten listar de forma segura el inventario remoto. Su presencia debe confirmarse en `/api/health/env` con una sesión ADMIN después del deploy, sin copiar el valor.

Los gates permanecen cerrados:

- `PAYMENTS_PRODUCTION_CONFIRMED=false`
- `MERCADOPAGO_CARD_ENABLED=false`

No se crearon preferencias, pagos, tokenizaciones ni reembolsos.

## 1. Reconciliación Git

- HEAD inicial: `3fd0ced180d823924ad54ddfe98acc26adcb62b0`.
- Se incorporaron por fast-forward los 16 commits concurrentes de la rama remota.
- Se fusionó `origin/main` sin reset, force-push ni reescritura: merge `4dba8fd`.
- Commit de hardening: `601c468cc6644845e43f80209cd327207736c535`.
- Base productiva al auditar: `f18fed87e46d0c2aee671fef87f1444971bb821a`.

## 2. Variables y preflight

Estado comprobado sin imprimir valores:

| Control | Local | Runtime público |
|---|---:|---:|
| `PAYMENTS_ENABLED=true` | Sí | Sí |
| `PAYMENTS_ENV=production` | Sí | Sí |
| `PAYMENTS_PROVIDER=mercadopago` | Sí | Coherente |
| `PAYMENTS_PRODUCTION_CONFIRMED=false` | Sí | Checkout desactivado |
| Access Token productivo presente | Sí | Requiere confirmación ADMIN |
| Access Token con formato productivo | Sí | Requiere confirmación ADMIN |
| Access Token alcanzable | Sí | No probado desde runtime |
| Cuenta productiva Argentina | Sí | No probado desde runtime |
| Public Key productiva presente | No | Requiere confirmación ADMIN |
| Webhook secret productivo presente | Sí | Requiere confirmación ADMIN |
| `MERCADOPAGO_CARD_ENABLED=false` | Sí | Sí |
| Credencial Card dedicada presente | No | Requiere confirmación ADMIN |
| Fallback Card a credencial general | Sí | Implementado |

El preflight ahora emite exclusivamente booleanos, rechaza placeholders/formato no productivo y usa sólo `GET /users/me`. Resultado local: token alcanzable, entorno compatible, cero operaciones creadas. La documentación oficial confirma que Public Key es pública/frontend y Access Token es privada/backend: https://www.mercadopago.com.ar/developers/es/docs/smartapps/resources/credentials?scope=prod

## 3. Checkout Pro

- Catálogo, precio unitario, subtotal, envío y total se recalculan server-side.
- La orden, el pago, los items y la reserva nacen en `create_checkout_order` de forma atómica.
- La función bloquea productos, revalida precio DB, total, disponibilidad e idempotency key.
- `payments.provider_session_id` evita doble checkout; la creación de preferencia usa idempotency key estable.
- `external_reference` y metadata usan `orderId`.
- La URL canónica local coincide con `https://www.fzacmateriales.store`; de allí se deriva `/api/webhooks/mercadopago`.
- Una preferencia fallida o sin URL libera la reserva; una preferencia válida persiste su ID.
- El email del comprador debe coincidir con la sesión autenticada.

## 4. Card Brick

- El SDK cliente recibe solamente Public Key; PAN, CVV y vencimiento permanecen dentro del Brick oficial.
- FZAC recibe un token efímero y no lo persiste ni lo loguea.
- Se endurecieron `payment_method_id`, issuer, cuotas y documento.
- El email del titular ahora debe coincidir con la cuenta autenticada.
- El monto se obtiene de la orden creada server-side y se vuelve a comparar con monto/moneda de la respuesta antes de confirmar.
- Respuestas ambiguas conservan la reserva para conciliación; sólo rechazo definitivo la libera.
- El flag continúa `false` y la API pública devuelve `cardEnabled=false` y Public Key vacía.

## 5. Webhook

- Ambos aliases delegan a un único handler; sólo exportan `POST`.
- Límite de body: 64 KiB; payment ID numérico validado.
- En producción exige `X-Signature`, `X-Request-Id` y secret productivo.
- Persiste un sobre sanitizado antes de procesar y deduplica por `(provider, provider_event_id)`.
- Reconsulta el pago directamente a Mercado Pago.
- Verifica provider, provider payment ID, order ID, monto, ARS y `live_mode`.
- Approved finaliza pago/orden/stock/ticket en una RPC atómica e idempotente.
- Rejected/cancelled/expired liberan reserva mediante RPC atómica.
- Refunded/charged_back usan cierre atómico; partial refund pasa a revisión manual.
- Se corrigió el orden de eventos: un evento viejo no terminal ya no degrada `PAID`/`REFUNDED`.

## 6. Base productiva

Verificación read-only en `gooxgjzetziwnxhuymmx`:

- RLS y FORCE RLS activos en las nueve tablas auditadas.
- Únicos presentes: `payments.order_id`, `(provider, provider_payment_id)`, `(provider, provider_event_id)`, `(order_id, product_id)` de reservas y `purchase_tickets.order_id`.
- `create_checkout_order`, `finalize_paid_order`, `finalize_failed_order`, `reserve_order_stock` y `release_order_stock_reservation`: `SECURITY DEFINER`, `search_path=''`, sin EXECUTE para anon/authenticated y con EXECUTE para service_role.
- Integridad: 0 pagos huérfanos; 0 diferencias pago/orden; 0 IDs/eventos/reservas/tickets/ventas duplicados; 0 pagos PAID sin provider ID; 0 reservas activas vencidas o ligadas a pagos terminales; 0 órdenes activas sin items.
- No se aplicaron migraciones ni escrituras.

## 7. Seguridad, API y cache

- No se encontraron secretos versionados ni `service_role` expuesta en cliente.
- Los snapshots de proveedor persisten sólo el sobre sanitizado; no guardan token/PAN/CVV.
- Checkout usa autenticación, identidad, origen confiable, body limitado, rate limit distribuido y control de concurrencia.
- CodeQL detectó que `?legal=register` podía controlar la aceptación legal de OAuth. Se eliminó el parámetro y se reemplazó por una intención firmada server-side, HttpOnly, SameSite, con TTL de 10 minutos, protección de origen y rate limit.
- `/api/cart`, `/api/account/*`, `/api/admin/*` y `/api/health/env` respondieron con `private, no-store`.
- CSP productiva permite el SDK/dominos de Mercado Pago y no incluye `unsafe-eval`; HSTS está activo.
- Advisor Supabase: 0 Critical/High. Pendiente Medium: Leaked Password Protection desactivado. Los cuatro avisos INFO de RLS sin policies son deny-by-default intencional.

## 8. Tests

- `pnpm typecheck`: OK.
- `pnpm lint`: OK, 0 warnings.
- `pnpm test`: 25/25 OK.
- `pnpm security:check`: OK; 37 tablas públicas exigen FORCE RLS.
- `pnpm build`: OK; 78 páginas.
- Playwright pagos/seguridad contra producción: 28/28 OK.
- Playwright completo contra SHA productivo anterior: 182 OK, 36 skip, 6 fallos por desfase del deploy/expectativas ya corregidas en rama.
- Reejecución del conjunto afectado contra el build local actual: 49/49 OK, 23 skip previstos.
- OAuth/privacidad contra el build final: 25 OK, 1 skip previsto; endpoint de intención legal 200 same-origin, cookie HttpOnly y 403 cross-origin.

Cobertura añadida: gates productivos, preflight sin filtración, placeholder/test credentials, firma inválida, cache privado, monto/moneda Card, identidad del titular, estados terminales y replay lógico.

## 9. Hosting

- Vercel `materiales-fzac-391o`: deployment `dpl_AgQfu5sFpJDAiSU2hYTPVVqo592V`, READY, SHA `f18fed8`.
- Render `materiales-fzac`: deploy `dep-dar5vl7lk1mc73d5psig`, live, SHA `f18fed8`.
- Dominio y Render responden HTTP 200 y reportan el mismo SHA.
- No hubo logs de checkout/webhook en Render durante las 24 horas consultadas.

## 10. Riesgos y pasos manuales

### Blockers

1. Integrar la rama mediante PR y esperar que Vercel/Render publiquen exactamente el nuevo SHA.
2. Con ADMIN, abrir `/api/health/env` y confirmar sólo booleanos: Access Token, Public Key y webhook secret productivos presentes; readiness bloqueada únicamente por el gate intencional.
3. Ejecutar `pnpm preflight:mercadopago` dentro de un entorno que contenga el conjunto productivo completo. Debe devolver `credentialsReachable=true`, `environmentMatches=true`, ambos gates `false` y cero operaciones creadas.

### Antes de cambiar cualquier gate

1. Confirmar dominio canónico, SSL, callback y webhook oficiales en el panel de Mercado Pago.
2. Enviar una notificación de prueba firmada desde Mercado Pago y verificar evento `PROCESSED`/`IGNORED`, sin orden real.
3. Confirmar alertas, acceso admin a eventos, reservas vencidas en cero y monitoreo/logs sin datos sensibles.
4. Hacer backup lógico/point-in-time y definir responsable de conciliación/reembolso.
5. Activar primero sólo `PAYMENTS_PRODUCTION_CONFIRMED` para un smoke real autorizado de importe mínimo, manteniendo Card Brick en `false`; verificar pago, orden, stock, ticket e idempotencia y volver a `false` ante cualquier desvío.
6. Habilitar Card Brick en una ventana posterior y separada, sólo tras la prueba oficial controlada del Brick y conciliación completa.

No activar ambos gates simultáneamente.
