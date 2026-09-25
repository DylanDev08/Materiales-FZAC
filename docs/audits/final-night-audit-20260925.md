# Materiales-FZAC — FINAL NIGHT AUDIT

Fecha: 25 de septiembre de 2026  
Rama: `release/final-production-audit-20260924`  
PR: [#33](https://github.com/DylanDev08/Materiales-FZAC/pull/33)

## 1. Resumen ejecutivo

La release quedó integrada contra el `main` vigente, sin reescritura de historia ni merge del PR. Se corrigieron categorías vacías publicadas, un 500 observado en Vercel al refrescar cookies desde Server Components, liberación insegura de reservas ante respuestas ambiguas de Mercado Pago, revocación incompleta de dispositivos confiables, mensajes técnicos de validación de dirección y un touch target legal demasiado bajo en mobile.

El código, catálogo y suite local están listos. El go-live sigue bloqueado de manera deliberada por credenciales/configuración comercial, el límite externo de builds de Vercel y la necesidad de coordinar frontend/backend. No se activaron cobros, Card Brick, SEO ni se hicieron pagos o reembolsos reales.

## 2. Commits realizados

| Commit | Mensaje | Motivo |
| --- | --- | --- |
| `21cb252` | `fix(catalog): oculta rubros vacíos dinámicamente` | Derivar navegación pública del catálogo activo y conservar URLs válidas con estado vacío. |
| `c126563` | `fix(security): cierra fallos ambiguos de sesión y pago` | Conservar reservas ante timeout de proveedor, endurecer reset de contraseña y cubrir la política. |
| `5e73c9a` | `test(qa): alinea navegación y controles responsive` | Corregir validación de Maps, touch target mobile y tests obsoletos. |
| `3a46659` | merge de la rama remota | Incorporar el cambio concurrente sin force-push. |
| `8912b53` | merge de `origin/main` | Reconciliar el release candidate con el `main` vigente. |

## 3. PR #33

- Head final local antes del informe: `8912b53` (el commit del informe se agrega al cierre).
- Estado: abierto; no se hizo merge.
- Mergeabilidad previa: `true`, estado GitHub `unstable` por integración externa.
- Quality Gate: exitoso en el head remoto anterior; debe volver a ejecutarse sobre el head final.
- CodeQL JavaScript/TypeScript: exitoso en el head remoto anterior; debe volver a ejecutarse sobre el head final.
- Vercel: el preview previo quedó bloqueado por límite de despliegues (`Deployment rate limited — retry in 24 hours`). El PR debe permanecer abierto hasta tener build frontend exitoso y deploy coordinado con Render.

## 4. Bugs encontrados y corregidos

| Problema | Impacto | Archivos principales | Solución | Validación |
| --- | --- | --- | --- | --- |
| Categorías activas sin productos aparecían en navegación | Accesos vacíos y expectativa comercial falsa | `lib/db/catalog.ts`, Home, catálogo, navbar, categoría | Categorías públicas derivadas dinámicamente de productos activos; Admin/DB no se alteran; URL directa válida devuelve estado vacío 200 | Playwright de Home, catálogo y categoría vacía |
| Filtro con categoría inexistente podía devolver catálogo general | Resultado engañoso | `lib/db/catalog.ts` | Devuelve lista vacía cuando el filtro no pertenece al catálogo público | Playwright de catálogo |
| `/carrito` produjo 500 en Vercel con sesión a refrescar | P0 de navegación para sesiones caducadas | `lib/supabase/server.ts` | Adaptador SSR `getAll/setAll` tolerante en Server Components; el proxy persiste el refresh | Test unitario y build; error confirmado en observabilidad previa |
| Timeout/error ambiguo de Card Brick liberaba reserva | Riesgo de sobreventa si Mercado Pago aceptó y la respuesta se perdió | `app/api/checkout/card/route.ts` | Mantener reserva hasta webhook/expiración; finalizar sólo rechazo definitivo | Test de política de pago |
| Reintento tras rechazo definitivo reutilizaba intención | UX/idempotencia incorrecta | `components/checkout/checkout-form.tsx` | Reinicia intención solamente para `CARD_PAYMENT_REJECTED` | Typecheck y test de contrato |
| Reset de contraseña ignoraba fallo al revocar trusted devices | Sesión de confianza podía sobrevivir al cambio de clave | reset route y `lib/auth/trusted-device.ts` | Borra cookie, normaliza usuario, revoca DB y falla cerrado si no concluye | Security check |
| Shipping devolvía `Required` | Mensaje técnico para el cliente | `app/api/shipping/quote/route.ts` | Mensaje obligatorio explícito para `placeId` de Google | Tres pruebas de shipping |
| Botón de arrepentimiento medía 30 px en mobile | Objetivo táctil insuficiente | `styles/storefront.css` | Mínimo 44 px y texto más legible | Cuatro proyectos mobile |
| Auditores/tests incluían datos archivados o rutas renombradas | Falsos negativos de QA | scripts y tests E2E | Auditor de Yesera limitado a productos activos; fixtures ajustadas al catálogo y migraciones reales | Auditor 110/110 y Playwright completo |

## 5. Catálogo

| Métrica | Resultado |
| --- | ---: |
| Productos totales | 1770 |
| Productos activos | 112 |
| CONSULT | 110 |
| IN_STOCK | 2 |
| OUT_OF_STOCK activos | 0 |
| Precio inválido o <= 0 | 0 |
| Sin foto | 0 |
| Sin descripción útil | 0 |
| Sin marca | 0 |
| Sin categoría | 0 |
| En categoría inactiva | 0 |
| Stock negativo | 0 |
| Slugs activos duplicados | 0 |
| SKUs activos duplicados | 0 |
| Imágenes activas faltantes | 0 |
| Productos activos Yesera trazables | 110 |
| Yesera con margen 10% | 89 |
| Yesera con margen 8% | 21 |
| Desvíos de fórmula | 0 |
| Universo Pinturas activo | 0 |

Los dos productos manuales con stock real son `FZAC-DRY-125` y `FZAC-CEM-50`. No se inventaron costos, stock ni fuentes.

## 6. PRECIOS A REVISAR MAÑANA

No hay productos en estado **ERROR OBJETIVO** ni **REVISAR** según las reglas solicitadas. Los dos productos manuales no tienen costo proveedor trazable; esto es una revisión comercial opcional, no evidencia de precio incorrecto, por lo que no se los incluye artificialmente en la tabla.

| Producto | SKU | Costo proveedor | Precio FZAC | Margen % | Fuente | Motivo |
| --- | --- | ---: | ---: | ---: | --- | --- |
| _Sin elementos_ | — | — | — | — | — | No se detectaron errores objetivos. |

## 7. Checkout y delivery

- Carrito distingue CONSULT de stock comprable y no habilita checkout directo para CONSULT.
- Las cantidades se revalidan server-side; el snapshot de precio no confía en el cliente.
- Retiro no requiere domicilio y conserva costo $0.
- Delivery exige una selección Google con `placeId`; editar dirección invalida la referencia previa.
- Routes API opera server-side, valida coincidencia de lugar y falla cerrada.
- Error de Maps ofrece un mensaje humano y no expone la clave.
- La estructura de tarifa existe y la configuración local reporta tarifa automática presente; no se inventó una fórmula nueva.

## 8. Mercado Pago

### LISTO

- Selección separada de credenciales test/producción.
- Idempotencia para Card Brick.
- Webhooks canónico y compatible delegan al mismo handler.
- Firma HMAC, `x-request-id`, `data.id`, asociación local, monto, moneda y `live_mode` validados.
- RPC `finalize_failed_order` transaccional, con locks, reintento seguro, reserva ACTIVE y privilegio exclusivo `service_role`.
- Preflight autenticó server-side contra Argentina sin crear pagos, preferencias ni refunds.

### BLOQUEADO INTENCIONALMENTE

- `PAYMENTS_PRODUCTION_CONFIRMED=false`.
- `MERCADOPAGO_CARD_ENABLED=false`.
- No se ejecutaron cobros ni reembolsos reales.

### ACCIÓN MANUAL MAÑANA

- Confirmar las credenciales exclusivas de producción y el webhook en Render.
- Configurar `NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY` también en Render, porque el runtime del checkout obtiene `cardEnabled/cardPublicKey` desde el backend canónico.
- Hacer una compra real mínima sólo después del deploy coordinado.

## 9. Auth y seguridad

- Email/password, callback Google canónico, logout, recuperación, verificación y MFA tienen controles server-side.
- Admin exige rol real y assurance MFA/trusted device; no se confía en rol del frontend.
- Cambio de contraseña cierra sesiones globales y revoca trusted devices con fallo cerrado.
- Redirects permanecen internos/canónicos; previews no se convierten en origen productivo.
- Turnstile y secretos no se versionaron ni imprimieron.
- Admin/API anónimos fueron rechazados en Playwright.
- Hallazgo externo: Leaked Password Protection sigue desactivado en Supabase y requiere activación manual en Auth.

## 10. Supabase / RLS

- 37 tablas públicas verificadas con FORCE RLS.
- Tablas sensibles auditadas: `supplier_documents`, `supplier_document_items`, `product_supplier_sources`, `payments`, `payment_events`, `orders`, `profiles`, `admin_audit_logs`, `stock_reservations`.
- `stock_reservations`, trusted devices y rate limits quedan deny-by-default con cero policies; no se añadió una policy insegura para silenciar el advisor.
- `finalize_failed_order`: `SECURITY DEFINER`, `search_path` seguro, revocado a public/anon/authenticated y concedido a `service_role`.
- Integridad actual: 0 pagos huérfanos, 0 diferencias de monto, 0 órdenes activas sin items, 0 reservas ACTIVE vencidas.
- Advisor de seguridad: sin high/critical; un warning por Leaked Password Protection y cuatro avisos informativos de RLS sin policy.
- Advisor de performance: índices sin uso y policies permisivas duplicadas. No se eliminaron índices ni se cambió RLS sin métricas de tráfico.

## 11. Admin / Proveedores / Reportes

- Proveedores, documentos privados PDF/CSV/XLS/XLSX, compras, cuentas, rentabilidad, reportes y Analytics están presentes y protegidos por Admin.
- Archivos proveedor: bucket privado, MIME y límite de 10 MB verificados por implementación/tests existentes.
- Reporte cliente omite costo/margen; reporte interno conserva costo, margen y ganancia.
- Vercel Analytics está instrumentado con consentimiento y Admin muestra “sin datos suficientes” sin inventar métricas.
- No se modificaron datos de proveedores ni documentos productivos durante esta auditoría.

## 12. Mobile / UX

- Viewports cubiertos: 360, 390/393, 412, 430, 768, 1440 y 1920 px.
- Sin overflow horizontal en rutas públicas principales.
- Botón legal alcanza 44 px; header, chatbot y WhatsApp no dominan el viewport.
- Catálogo CONSULT permite añadir al carrito y muestra feedback; el carrito deriva a disponibilidad, no a un pago falso.
- Menú mobile, login/registro, detalle, 404, galería, carrusel y categoría vacía validados.

## 13. Performance

- Catálogo limita inicialmente el DOM a 24 cards y carga más bajo demanda.
- Categorías públicas se resuelven con dos lecturas acotadas y cache React por request, sin N+1 por producto.
- Imágenes activas usan Storage propio y componentes optimizados donde aplica.
- No se retiraron índices marcados como “unused”: el volumen/tráfico aún no justifica esa mutación.

## 14. Logs

- Render últimas 24 h: 0 logs `error` y 0 requests 5xx.
- Vercel últimas 24 h: se observó `/carrito` 500 por escritura de cookies desde Server Component; corregido en el release candidate.
- El error histórico `/productos%5C` pertenece a un deployment anterior y ya existe normalización en proxy.
- No se hallaron payloads de tarjeta, contraseñas, cookies o tokens impresos.

## 15. Infraestructura

- Render canónico: `materiales-fzac`, servicio `srv-d9btk2u1a83c73c8fp8g`, rama `main`, deploy live previo `dep-daqprmvf3r2c73bncebg` en SHA `95dc2b6`.
- Vercel canónico: `materiales-fzac-391o`, proyecto `prj_EqB7dnnuor0xae0rqgozLIsucFzd`.
- Dominio oficial y Render respondieron HTTP 200 en `/`, `/productos` y `/api/health`.
- El release candidate no se desplegó porque el PR sigue abierto y el build Vercel está limitado; producción no fue desincronizada.

## 16. Acciones manuales para mañana

1. Activar Leaked Password Protection en Supabase Auth.
2. Esperar/liberar el límite de Vercel y confirmar Quality Gate + CodeQL sobre el head final.
3. Completar/verificar variables productivas de Mercado Pago en Render sin activar aún los gates.
4. Coordinar merge de #33 y despliegues Vercel + Render sobre el mismo SHA.
5. Verificar health, login Google/email y recepción de webhook en producción.
6. Habilitar gates de pago y ejecutar una compra mínima real controlada.
7. Activar `SEO_INDEXING_ENABLED=true` sólo después del smoke productivo.

## 17. GO-LIVE CHECKLIST

- [ ] Variables productivas verificadas en Render/Vercel.
- [x] Smoke local no destructivo.
- [ ] Merge PR #33.
- [ ] Deploy coordinado frontend/backend.
- [x] Health actual HTTP 200.
- [x] Login/auth cubierto sin credenciales personales.
- [x] Checkout cubierto sin cobro real.
- [x] Webhook validado por tests puros.
- [ ] Compra real mínima.
- [ ] Activar SEO si corresponde.

## 18. Veredicto técnico

**B) LISTO EXCEPTO BLOQUEOS EXTERNOS/MANUALES**

Riesgos residuales: límite de build Vercel, credenciales/gates productivos todavía deliberadamente incompletos, Leaked Password Protection manual y ausencia —por instrucción— del smoke de cobro real. No corresponde mergear ni declarar producción actualizada hasta resolverlos de forma coordinada.
