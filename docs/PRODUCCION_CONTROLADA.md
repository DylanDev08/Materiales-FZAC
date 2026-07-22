# Produccion controlada FZAC

Esta checklist se usa antes de cambiar Materiales FZAC de pruebas a operacion real. No incluye secretos ni credenciales.

## 1. Identidad y dominio

- Verificar dominio final del e-commerce.
- Configurar `NEXT_PUBLIC_SITE_URL` con HTTPS publico.
- Confirmar que Google OAuth tenga redirect URL del dominio final.
- Confirmar que Mercado Pago use el mismo dominio en `back_urls` y webhook.

## 2. Emails transaccionales

- Verificar dominio en Resend.
- Cargar DNS SPF, DKIM y DMARC.
- Configurar:

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=Materiales FZAC
```

- Probar registro manual.
- Probar recuperacion de contrasena.
- Probar constancia de arrepentimiento cuando se active envio automatico.

## 3. Mercado Pago

- En pruebas:
  - `PAYMENTS_ENV=test`.
  - Usar comprador `TESTUSER`.
  - No usar la cuenta vendedora como compradora.

- En produccion:
  - `PAYMENTS_ENV=production`.
  - Usar credenciales productivas.
  - Configurar webhook publico:

```text
https://DOMINIO/api/webhooks/mercadopago
```

- Ejecutar compra real de bajo monto.
- Confirmar webhook recibido.
- Confirmar stock, pedido, pago y comprobante.
- Ejecutar reembolso total de prueba controlada.

## 4. Supabase y RLS

- Confirmar RLS activo en tablas sensibles.
- Confirmar que usuario comun solo ve sus pedidos, pagos, tickets y direcciones.
- Confirmar que admin ve datos operativos.
- Confirmar que `profiles.role` no puede modificarse desde cliente.
- Confirmar indice unico parcial de idempotencia para `payments.provider_session_id`.

## 5. Seguridad web

- Mantener headers actuales.
- Revisar `Content-Security-Policy-Report-Only` durante pruebas.
- Cuando no haya reportes criticos, pasar CSP a modo bloqueante.
- Rotar claves compartidas antes de produccion.

## 6. Rollback

- Mantener ultimo deploy estable en Render.
- Si Mercado Pago falla, desactivar `PAYMENTS_ENABLED` o volver a `PAYMENTS_ENV=test`.
- Si Resend falla, el backend usa fallback de Supabase para Auth.
- Si webhook falla, revisar Admin > Estado del sistema y Admin > Comprobantes de pago.
