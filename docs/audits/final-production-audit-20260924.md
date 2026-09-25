# Auditoría final de producción — Materiales FZAC

Fecha: 24/09/2026  
Rama auditada: `release/final-production-audit-20260924`  
PR: #33

## Estado verificado

### Catálogo

- 112 productos activos.
- 112/112 con precio público válido.
- 112/112 con imagen configurada.
- 112/112 imágenes activas resuelven a objetos existentes en Storage `product-images`.
- 110 productos quedan en `CONSULT`.
- 2 productos tienen stock FZAC real y estado `IN_STOCK`.
- Los 110 productos con costo de proveedor trazable mantienen márgenes comerciales de 8% o 10%.
- Los 2 productos manuales con stock no reciben un costo de proveedor inventado.
- El catálogo de referencia de Universo Pinturas permanece archivado.
- La placa Durlock duplicada quedó desactivada de forma reversible y la migración quedó versionada.

### Pagos

- `create_checkout_order`, `finalize_paid_order`, `finalize_failed_order` y `finalize_refunded_order` son SECURITY DEFINER y sólo ejecutables por `service_role`.
- Aprobaciones, reembolsos y rechazos/expiraciones de Mercado Pago tienen cierre atómico server-side.
- Webhook canónico y ruta legacy comparten el mismo handler.
- La validación de webhook verifica firma, ambiente, pago asociado, importe y moneda antes de mutar la orden.
- El CI exige conservar el cierre atómico de pagos fallidos.
- La activación real permanece cerrada mientras `PAYMENTS_PRODUCTION_CONFIRMED` no esté habilitado.
- No se realizó ninguna compra real durante esta auditoría.

Integridad remota comprobada:
- 0 órdenes activas sin items.
- 0 productos con stock negativo.
- 0 pagos huérfanos.
- 0 diferencias entre importe de pago y total de orden.
- 0 reservas activas vencidas.
- 0 pagos Mercado Pago finalizados sin `provider_payment_id`.

### Delivery

- El cliente debe seleccionar una dirección de Google Places y conservar su `placeId`.
- El backend vuelve a cotizar siempre antes de crear la orden.
- Google Routes geocodifica server-side la dirección textual y la tarifa sólo se acepta si el Place ID devuelto coincide con el seleccionado.
- Un cliente manipulado no puede combinar un Place ID cercano con un domicilio textual diferente para abaratar el envío.
- La configuración de lanzamiento controla por separado Browser Key de Places, Server Key de Routes y tarifa FZAC.

### Auth y administración

- 2 perfiles ADMIN reales.
- 2/2 con TOTP verificado.
- 2/2 con email confirmado.
- Cambio de contraseña revoca todos los dispositivos admin confiables.
- Google OAuth fuera de localhost utiliza el dominio canónico.
- Los logs recientes confirman flujo Google exitoso desde `www.fzacmateriales.store`.
- Las áreas nuevas de proveedores, reportes y analíticas exigen sesión admin.
- `main` tiene ruleset activo con bloqueo de borrado/non-fast-forward y checks requeridos: FZAC quality gate + CodeQL.

### Proveedores y documentos privados

- `supplier_documents` y `supplier_document_items` usan RLS + FORCE RLS.
- Bucket `supplier-documents`: privado, 10 MB, formatos PDF/CSV/XLS/XLSX.
- Upload valida tamaño, tipo y firma básica del archivo.
- Cada documento se vincula a un proveedor existente.
- Un producto vinculado debe pertenecer a ese proveedor o tener fuente comercial con ese proveedor.
- Los accesos a archivos usan signed URLs de 60 segundos.
- Altas de documentos/items requieren auditoría; si la auditoría falla se revierte la escritura.
- El smoke QA cubre upload temporal, rechazo de producto ajeno, comparación, signed URL, privacidad del bucket y cleanup.
- La UI abre la pestaña en el gesto del usuario antes de solicitar la signed URL para evitar bloqueo de popups.

### Reportes

- Reporte cliente: material, categoría, precio FZAC, unidad y disponibilidad.
- Costo, proveedor, ganancia y markup sólo aparecen en modo interno.
- La página completa requiere admin.
- El componente cliente de impresión no recibe la estructura completa de costos.
- El costo preferido es la última compra realmente recibida; si no existe, usa la fuente de proveedor vigente.

### Privacidad y Analytics

- Vercel Web Analytics ya no se monta globalmente.
- El consentimiento distingue:
  - almacenamiento necesario;
  - preferencias locales;
  - analítica de uso;
  - marketing, que permanece desactivado.
- Analytics sólo se monta cuando el visitante autoriza explícitamente `analytics=true`.
- Revocar la opción desmonta la instrumentación para navegación futura.
- Se versionó el consentimiento al 24/09/2026 para volver a solicitar decisión tras el cambio.
- La Política de privacidad identifica Vercel y describe la finalidad de Web Analytics.
- El security check falla si alguien vuelve a montar Analytics sin el wrapper de consentimiento.

### Runtime e infraestructura

Última revisión remota previa a este documento:
- 0 errores runtime agrupados en Vercel durante 24 h.
- 0 logs de error en Render canónico.
- 0 warnings/errors de producción Vercel en el mismo período.
- Render canónico: `materiales-fzac`.
- Vercel canónico: `materiales-fzac-391o`.
- El frontend de Vercel proxyfía `/api/*` al Render canónico.

## Warnings que no se corrigieron a ciegas

### Supabase performance advisor

- Índices marcados como “unused”: se conservaron. El tráfico es bajo/nuevo y varios protegen FKs o flujos operativos.
- “Multiple permissive policies”: principalmente combinación intencional de policy owner + policy admin. No se consolidaron antes del lanzamiento para no cambiar autorización por una optimización prematura.

### Supabase security advisor

Pendiente manual real:
- Leaked Password Protection en Auth está desactivado.

Informativos server-only:
- tablas con RLS habilitado y 0 policies, usadas con deny-by-default/service role.

## Gates manuales antes de cobrar dinero real

1. Habilitar Leaked Password Protection en Supabase Auth.
2. Ejecutar un smoke real de email transaccional (recuperación o confirmación) para certificar Resend/SMTP end-to-end.
3. Validar credenciales de Mercado Pago productivo con el preflight no destructivo.
4. Confirmar webhook productivo y su secret.
5. Mantener `PAYMENTS_PRODUCTION_CONFIRMED=false` hasta terminar el punto anterior.
6. Mantener `MERCADOPAGO_CARD_ENABLED=false` hasta validar Card Brick.
7. Sólo con validación final, activar los gates productivos.
8. Realizar la primera compra real con un monto mínimo y verificar:
   - orden;
   - pago;
   - evento webhook;
   - stock/reserva;
   - comprobante;
   - reembolso administrativo de prueba si corresponde al plan de lanzamiento.

## Cleanup de infraestructura

Aún existen duplicados históricos que no forman parte del runtime canónico:

Render:
- `materiales-fzac-8xmp`
- `materiales-fzac-8xmp-8xmp`

Vercel:
- `materiales-fzac`
- `materiales-fzac-sciy`

No se eliminaron automáticamente porque los conectores disponibles no exponen borrado de servicios/proyectos. No tocar proyectos de Portfolio.

## Criterio de merge

Mergear #33 sólo cuando Quality Gate y CodeQL del head final estén verdes. Si Vercel marca `build-rate-limit`, es una limitación de cuota y no un fallo de compilación, pero conviene coordinar el merge cuando Vercel pueda desplegar para reducir el desfase temporal entre frontend y backend.
