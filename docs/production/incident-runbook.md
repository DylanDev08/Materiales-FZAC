# Runbook de producción — Materiales FZAC

Última revisión técnica: 2026-09-22

Este documento sirve para diagnosticar incidentes sin borrar órdenes, pagos ni movimientos de stock. Los identificadores internos pueden compartirse dentro del equipo, pero nunca publicar tokens, cookies, access tokens, service roles ni datos personales de clientes.

## 1. Compra que no avanza

1. Abrir **Admin → Pedidos** y buscar la referencia.
2. Revisar el estado de la orden:
   - `PENDING_PAYMENT`: espera confirmación del proveedor.
   - `PENDING_ADMIN_APPROVAL`: requiere aprobación humana.
   - `PENDING_TRANSFER`: espera transferencia.
   - `COORDINATE`: pago/entrega coordinada.
   - `PAID`: pago confirmado y stock descontado.
3. Abrir **Admin → Pagos** y confirmar que exista un solo pago para la orden.
4. Abrir **Admin → Eventos de pago** y revisar el último evento de Mercado Pago.
5. Si el evento figura `FAILED`, no modificar stock manualmente. Revisar primero el motivo y el estado real en Mercado Pago.
6. Si el cliente fue cobrado pero la orden no está pagada, tratarlo como incidente prioritario: no volver a cobrar ni crear otra orden manual.

## 2. Webhook de Mercado Pago

Ruta canónica:

`/api/webhooks/mercadopago`

Controles esperados:

- body máximo 64 KiB;
- firma HMAC obligatoria en producción;
- consulta posterior del pago a Mercado Pago;
- comparación de monto y moneda;
- comparación de entorno test/production;
- asociación con la orden local;
- deduplicación por evento;
- finalización atómica mediante `finalize_paid_order`.

Si falla:

1. Revisar **Admin → Eventos de pago**.
2. Buscar logs por `request_id` / header `X-Request-Id`.
3. Confirmar que el webhook configurado en Mercado Pago apunta al dominio público activo.
4. Confirmar que `MERCADOPAGO_*_WEBHOOK_SECRET` pertenece al mismo ambiente.
5. No marcar manualmente una orden como pagada sin conciliar el pago real.

## 3. Pago aprobado pero orden no confirmada

No descontar stock a mano.

Verificar:

- que exista exactamente un registro en `payments` para la orden;
- que `provider_payment_id` no esté asociado a otra orden;
- que monto y moneda coincidan;
- que haya stock físico suficiente;
- que `finalize_paid_order` esté instalada;
- que no haya eventos `RECEIVED` trabados.

La base tiene un índice único por `provider + provider_payment_id` para impedir reutilizar el mismo pago externo.

## 4. Stock que no coincide

1. Revisar **Inventario**.
2. Buscar movimientos de tipo venta, compra, devolución o ajuste.
3. No editar `products.stock` directamente salvo mantenimiento controlado.
4. Una venta solo debe descontar stock al finalizar un pago aprobado.
5. Un reembolso completo debe restaurar stock mediante la transición atómica correspondiente.
6. Si el valor físico y el sistema difieren, registrar el motivo del ajuste.

### Riesgo conocido

El checkout valida y bloquea stock al crear la orden y vuelve a comprobarlo al finalizar el pago, pero las órdenes pendientes todavía no constituyen una reserva temporal de stock. Antes de tráfico alto conviene implementar reservas con expiración alineadas al vencimiento del checkout de Mercado Pago.

## 5. Órdenes sin productos

Existe histórico cancelado de QA/legacy de julio de 2026. No borrarlo automáticamente.

El control importante es **órdenes activas sin productos**. Debe mantenerse en cero.

## 6. Errores de checkout

Cada respuesta crítica incluye:

- `X-Request-Id`;
- `Server-Timing`.

Los logs estructurados registran:

- scope;
- request id;
- método;
- ruta;
- status HTTP;
- duración.

No registran body, email, tarjeta, token, cookies ni dirección del cliente.

Scopes principales:

- `checkout.create`
- `checkout.card`
- `payments.webhook`
- `admin.order.approve`
- `admin.order.reject`
- `admin.payment.refund`

## 7. Render

Si el backend parece caído:

1. Abrir el servicio canónico `materiales-fzac`.
2. Revisar último deploy y logs de error.
3. Probar `/api/health` desde la URL pública del frontend.
4. Confirmar que la respuesta indique `service: materiales-fzac`.
5. No desplegar los servicios duplicados legacy.

Mientras el servicio esté en plan Free puede existir cold start. Para checkout/pagos productivos se recomienda instancia always-on.

## 8. Supabase

Antes de aplicar cambios manuales:

- comprobar el project ref `gooxgjzetziwnxhuymmx`;
- no desactivar RLS;
- no conceder acceso público a tablas administrativas;
- no ejecutar DELETE de órdenes/pagos para "limpiar";
- preferir migraciones versionadas en `supabase/migrations`.

Controles esperados:

- stock negativo: 0;
- claves de idempotencia duplicadas: 0;
- IDs de pago externo duplicados: 0;
- órdenes activas sin items: 0;
- eventos de pago trabados: 0;
- pagos aprobados con orden desalineada: 0.

## 9. Rollback de código

Si un deploy nuevo rompe la aplicación:

1. Identificar el último commit sano.
2. Revertir el commit o redeployar la versión sana.
3. No revertir una migración destructivamente sin revisar si ya escribió datos.
4. Si código y migración dependen uno del otro, restaurar primero compatibilidad del código y después planificar la reversión de DB.

## 10. Checklist después de un incidente

- causa identificada;
- request id guardado;
- orden/pago conciliados;
- stock verificado;
- cliente informado si corresponde;
- no hubo doble cobro;
- logs sin datos sensibles;
- corrección versionada;
- Quality Gate verde;
- deploy LIVE;
- prueba de health y flujo afectado.
