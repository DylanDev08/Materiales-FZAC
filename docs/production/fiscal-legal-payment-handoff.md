# Salida productiva FZAC: pagos, ARCA y revisión legal

## 0. Identidad comercial confirmada

Datos disponibles para configuración comercial:

- Marca: **FZACONSTRUCCIONES / FZAC**
- Nombre comercial: **Fortaleza Construcciones**
- CUIT informado: **20-36454125-3**

La **razón social fiscal exacta** todavía debe confirmarse contra ARCA antes de completar `FZAC_LEGAL_NAME` o emitir documentación fiscal. El CUIT y los nombres comerciales pueden utilizarse en identidad interna/comercial sin asumir que alguno de ellos sea la denominación fiscal registrada.

Fecha de preparación técnica: 2026-08-21

Este documento organiza el traspaso al contador y al profesional legal. No reemplaza su dictamen ni autoriza por sí solo la emisión de comprobantes fiscales.

## 1. Estado técnico de pagos

La aplicación separa credenciales y webhooks de prueba y producción. Un cambio aislado de `PAYMENTS_ENV` no habilita cobros reales.

Para activar Mercado Pago productivo deben existir, en el mismo despliegue:

- `PAYMENTS_ENABLED=true`
- `PAYMENTS_PROVIDER=mercadopago`
- `PAYMENTS_ENV=production`
- `PAYMENTS_PRODUCTION_CONFIRMED=true`
- `MERCADOPAGO_PRODUCTION_ACCESS_TOKEN`
- `NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY`
- `MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET`
- `FZAC_PUBLIC_SITE_URL` o `NEXT_PUBLIC_SITE_URL` con HTTPS público

La URL pública canónica temporal es `https://materiales-fzac-391o.vercel.app`. El proxy `/api/*` deriva al backend canónico de Render. Cuando exista el dominio propio, reemplazar esta URL en callbacks, webhooks, canonical y configuraciones externas antes de habilitar SEO.

El webhook productivo debe apuntar a:

`https://materiales-fzac-391o.vercel.app/api/webhooks/mercadopago`

Evento mínimo: `Pagos`. La clave secreta debe obtenerse de la pestaña productiva del webhook y no debe reutilizarse desde sandbox.

Una vez cargadas las variables en un entorno seguro, validar la autenticación sin crear cobros:

`pnpm run preflight:mercadopago`

El comando no imprime credenciales, no crea preferencias y rechaza usuarios tester o cuentas fuera de Mercado Pago Argentina.

Para un lanzamiento conservador se recomienda comenzar con Checkout Pro. El Card Payment Brick puede habilitarse después con credenciales productivas y una compra real controlada; FZAC nunca recibe ni almacena número de tarjeta, vencimiento o CVV.

Documentación oficial:

- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/go-to-production
- https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications

## 2. Decisiones que debe validar el contador

Antes de habilitar `FISCAL_INVOICING_ENABLED=true`, confirmar por escrito:

- Razón social exacta y CUIT del emisor.
- Condición frente al IVA e Ingresos Brutos.
- Domicilio fiscal y comercial que debe figurar en el comprobante.
- Punto de venta electrónico habilitado.
- Tipos de comprobante aplicables según emisor y comprador.
- Tratamiento de IVA, percepciones, descuentos, envío y redondeos.
- Datos mínimos del comprador y umbrales de identificación vigentes.
- Momento fiscal de emisión: pago aprobado, entrega u otra regla definida.
- Flujo de notas de crédito para cancelaciones, devoluciones y reembolsos.
- Conservación y conciliación entre orden, pago de Mercado Pago, CAE y comprobante.

Elegir una sola estrategia:

1. Proveedor fiscal homologado con API y webhooks.
2. Integración directa ARCA mediante WSAA + WSFE, certificados, clave privada y ambiente de homologación.

La integración directa exige certificado, clave privada protegida, servicio delegado, punto de venta y solicitud de CAE. Primero debe probarse en homologación. Referencia oficial:

- https://www.arca.gob.ar/fe/
- https://www.arca.gob.ar/fe/documentos/AccionesarealizarparaconsumirunWebservicedeFacturaElectr.pdf

Hasta completar esa decisión, el documento generado por FZAC continúa identificado como **comprobante interno**, no como factura fiscal.

## 3. Información que debe revisar el profesional legal

- Identidad completa del proveedor y canales de contacto.
- Términos y condiciones de venta.
- Política de privacidad y tratamiento de datos.
- Entregas, retiro, validación de stock y plazos.
- Cambios, garantías, devoluciones y reembolsos.
- Botón de arrepentimiento y constancia de la solicitud.
- Consentimiento de cookies por categoría.
- Conservación de pedidos, pagos, comprobantes y auditoría.
- Textos de aceptación y versionado de políticas.

La aplicación ya diferencia comprobante interno de factura fiscal, mantiene solicitudes de arrepentimiento y restringe reembolsos a administradores. La redacción final debe ser aprobada por un profesional matriculado.

## 4. Ensayo controlado antes de abrir ventas

1. Aplicar y verificar todas las migraciones pendientes en Supabase.
2. Cargar identidad legal validada en variables de entorno.
3. Activar credenciales productivas de la misma aplicación Mercado Pago.
4. Configurar y simular el webhook productivo firmado.
5. Desplegar y comprobar el estado del panel Sistema.
6. Crear una compra real de importe mínimo con un cliente autorizado.
7. Confirmar una sola orden, un solo pago, un solo descuento de stock y un solo comprobante interno.
8. Ejecutar el reembolso desde admin y verificar la devolución en Mercado Pago.
9. Cuando exista integración fiscal, verificar CAE, numeración y nota de crédito.
10. Recién después habilitar tráfico comercial e indexación.

## 5. Evidencia a conservar

- Commit desplegado y fecha.
- Captura del modo productivo y aplicación de Mercado Pago.
- Resultado de simulación del webhook.
- IDs internos de la compra controlada, sin publicar datos personales.
- Conciliación del pago y reembolso.
- Aprobación del contador sobre facturación.
- Aprobación legal sobre políticas y defensa del consumidor.
