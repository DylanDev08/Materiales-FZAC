# Produccion controlada FZAC

Esta checklist se usa antes de cambiar Materiales FZAC de pruebas a operacion real. No incluye secretos ni credenciales.

## 1. Identidad y dominio

- Verificar dominio final del e-commerce.
- Configurar `NEXT_PUBLIC_SITE_URL` con HTTPS publico.
- Mantener `SEO_INDEXING_ENABLED=false` durante Render temporal y pruebas.
- Cambiar `SEO_INDEXING_ENABLED=true` solo después de revisar dominio, canonicals, `robots.txt` y `sitemap.xml`.
- Confirmar que Google OAuth tenga redirect URL del dominio final.
- Confirmar que Mercado Pago use el mismo dominio en `back_urls` y webhook.

### SEO y buscadores

- Verificar que el dominio final responda una sola versión HTTPS.
- Confirmar que `/robots.txt` permita rutas públicas y bloquee cuenta, checkout, carrito, APIs y panel admin.
- Confirmar que `/sitemap.xml` incluya productos y categorías activas.
- Registrar el dominio en Google Search Console y enviar el sitemap.
- Revisar títulos, descripciones, canonical y Open Graph de home, catálogo, categorías y productos.
- Validar los datos estructurados de tienda, buscador, producto y breadcrumbs.
- Mantener imágenes reales, nítidas y representativas para cada producto antes de solicitar indexación.

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

- [x] RLS activo en todas las tablas publicas auditadas.
- [x] Usuario comun limitado a sus pedidos, pagos, tickets y direcciones.
- [x] Administradores autorizados confirmados con rol `ADMIN`.
- [x] `profiles.role` protegido por trigger contra escalacion desde cliente.
- [x] Indice unico parcial para `payments.provider_session_id`.
- [x] Historial remoto alineado con `supabase/migrations`.
- [x] Security Advisor revisado y RPC de pagos cerrada a `service_role`.
- [x] Storage limitado a imagenes JPG, PNG o WebP de hasta 5 MB.
- [ ] Configurar CAPTCHA cuando exista un secret dedicado.
- [ ] Activar proteccion HIBP al contratar Supabase Pro.
- [ ] Definir retencion y limpieza de tablas Prisma/ordenes de prueba.

Evidencia: `docs/audits/supabase-remote-security-audit.md`.

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
