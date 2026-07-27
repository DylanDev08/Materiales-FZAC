# QA funcional autenticado y saneamiento preproduccion

Fecha: 2026-07-27  
URL de referencia: `https://materiales-fzac-8xmp.onrender.com/`  
Commit de partida: `323d4b2`  
Entorno de ejecucion: build local de produccion conectado al proyecto Supabase remoto y Mercado Pago test.

## Resumen ejecutivo

El modulo autenticado, la cuenta, el checkout y las vistas mobile pasaron las pruebas automatizadas sin errores de integridad. Se agrego cobertura reproducible para perfil y direcciones, se reforzo el contrato de texto de direcciones y se corrigio la configuracion de Playwright que repetia pruebas no visuales en cada dispositivo.

El saneamiento elimino 36 pedidos historicos identificados de forma estricta como QA, junto con sus 36 pagos pendientes y notificaciones relacionadas. Antes de borrar se verifico que todos estuvieran pendientes, sin `paid_at` y sin comprobantes. Tambien se desactivaron 9 preferencias sandbox. Quedaron 28 pedidos pendientes no identificados como QA; no se tocaron.

## Resultados

| Area | Estado | Evidencia |
| --- | --- | --- |
| Login email/password | OK | Usuario efimero confirmado, login HTTP 200 y cookie de sesion |
| Registro manual | Parcial automatizado | Validaciones invalidas HTTP 422; alta con entrega real de email queda en checklist manual |
| Google OAuth | Parcial automatizado | Redirect flow y callback seguro validados; consentimiento real de Google queda manual |
| Rol administrativo | OK | Un `role=ADMIN` inyectado para email no autorizado no alcanza APIs admin |
| Perfil | OK | Validacion de telefono, persistencia y preservacion de rol |
| Direcciones | OK | Alta, edicion, baja, render en cuenta y limite de propiedad |
| Enumeracion de emails | OK | Email existente e inexistente devuelven el mismo contrato publico |
| Checkout transferencia | OK | HTTP 201, pendiente, sin redirect de Mercado Pago |
| Checkout WhatsApp | OK | HTTP 201, pendiente, URL `wa.me`, sin redirect de Mercado Pago |
| Checkout Mercado Pago | OK test | Preferencia sandbox y orden pendiente; preferencia desactivada en cleanup |
| Idempotencia | OK | Replay devuelve el mismo pedido y pago |
| Tarjeta embebida | Cerrada | Endpoint HTTP 503 y sin escritura mientras el modo Card Brick siga deshabilitado |
| Checkout mobile | OK | Metodos apilados, resumen colapsable, sin overflow y sin zoom iOS |
| Admin mobile | OK | Ruta protegida, sidebar drawer, touch targets y sin overflow |
| E2E | OK | 108 passed, 31 skipped por requerir habilitacion mutante explicita |
| Concurrencia local | OK funcional | Sin HTTP 500; rate limit 429 con `Retry-After` |
| Dependencias produccion | OK | `npm audit --omit=dev`: 0 vulnerabilidades |

## Cambios aplicados

- Nuevo `scripts/account-flow-smoke.mjs` para probar sesion, perfil, direcciones, propiedad y privacidad.
- Nuevo `scripts/cleanup-qa-orders.mjs`, con dry-run por defecto y confirmacion explicita para borrar.
- Validacion de campos de direccion contra HTML/script y caracteres de control.
- Las notas mantienen su politica mas estricta.
- Las direcciones naturales con apostrofes siguen permitidas; la defensa SQL depende de consultas parametrizadas, no de bloquear palabras comunes.
- Los proyectos mobile de Playwright ejecutan solo `mobile-ui.spec.ts`; seguridad y smoke publico no se duplican por viewport.

## Concurrencia

Prueba local controlada:

- Busqueda: 100 solicitudes, 90 HTTP 200 y 10 HTTP 429, p95 aproximado 3016 ms.
- Validacion de carrito: 80 solicitudes, 58 HTTP 422 y 22 HTTP 429, p95 aproximado 1801 ms.
- Cero HTTP 500.
- El asistente se omitio porque la instancia se encontraba con persistencia habilitada.

Los tiempos incluyen saturacion intencional y no representan navegacion normal. El plan gratuito de Render y sus cold starts siguen siendo un riesgo de latencia para produccion.

## Saneamiento

Comandos:

```powershell
npm run qa:cleanup
$env:QA_CLEANUP_CONFIRM='DELETE_ISOLATED_QA'; npm run qa:cleanup
```

El primer comando solo informa. El segundo borra exclusivamente pedidos pendientes con email `example.com`, marcas QA, pagos pendientes y cero comprobantes. Cualquier cambio de estado detiene la operacion.

Resultado ejecutado:

- 36 pedidos QA eliminados.
- 36 pagos pendientes asociados eliminados por el contrato de base.
- 9 preferencias Mercado Pago sandbox desactivadas.
- 0 comprobantes afectados.
- Dry-run posterior: 0 candidatos.

## Pendientes antes de produccion

1. Completar manualmente registro, confirmacion de email, recuperacion y Google OAuth desde un telefono real.
2. Definir dominio para callbacks, remitente Resend, indexacion SEO y URLs definitivas.
3. Validar Mercado Pago con credenciales productivas solo despues del dominio y con activacion explicita.
4. Revisar manualmente los 28 pedidos pendientes restantes; no tienen marcadores suficientes para borrarlos automaticamente.
5. Habilitar CAPTCHA cuando exista provider/secret.
6. Evaluar Render pago o infraestructura equivalente para reducir cold starts.
7. Las 9 alertas de `npm audit` completo pertenecen a ESLint/minimatch en desarrollo. Produccion tiene cero; no se aplico un downgrade/upgrade mayor forzado.

## Comandos verificados

```text
npm install                       OK
npm run typecheck                 OK
npm run lint                      OK
npm run security:check            OK
npm run build                     OK (62 rutas)
npm audit --omit=dev              OK, 0 vulnerabilidades
npm run test:auth-roles           OK
npm run test:account-flow         OK
npm run test:checkout-flow        OK
npm run test:mobile-checkout      OK
npm run test:mobile-admin         OK
npm run test:load                 OK, sin HTTP 500
npx playwright test               OK, 108 passed / 31 skipped
```
