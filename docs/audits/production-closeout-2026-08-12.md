# Cierre técnico de preproducción FZAC

Fecha: 12 de agosto de 2026
Entorno revisado: repositorio local y configuración de Render/Supabase declarada
Gestor de paquetes: pnpm 11.21.0

## Resumen ejecutivo

La aplicación conserva su arquitectura Next.js + Supabase + Mercado Pago y recibió un cierre transversal de seguridad, operación y presentación. No se habilitaron cobros reales, indexación pública, facturación fiscal ni cambios destructivos en datos. Las operaciones financieras permanecen auditables: la nueva limpieza administrativa anula movimientos manuales y nunca borra ventas, pagos, pedidos, tickets o comprobantes.

## Resultado por área

| Área | Estado | Acción realizada | Pendiente humano |
| --- | --- | --- | --- |
| Auth/JWT | Endurecido | La sesión se valida con `auth.getUser()` en servidor; el rol admin se recalcula contra `ADMIN_EMAILS`; recuperación evita enumeración | Probar recepción de email y Google OAuth con el dominio final |
| APIs | Endurecido | Guard de origen, JSON y tamaño en auth, carrito, checkout, envío, asistente y admin; rate limits y errores humanos | Rate limiter distribuido si Render escala a más de una instancia |
| Pagos | Protegido en test | Precio/stock server-side, idempotencia, webhook y separación MP/transferencia/WhatsApp preservados | Credenciales productivas nuevas, pago real de bajo monto y reembolso controlado |
| RLS | Migración preparada | FORCE RLS adicional, revocación de escritura directa sensible y RPC de mantenimiento solo `service_role` | Aplicar la migración remota con una conexión Supabase vigente y revisar Security Advisor |
| Admin | Mejorado | Contexto común de autorización, mantenimiento contable seguro, vista móvil del libro, documentación de retención | Completar identidad fiscal y capacitar al operador |
| Clientes | Mejorado | CSV editable con BOM e informe FZAC imprimible/PDF con logo, contacto y resumen | Completar razón social, CUIT y dirección validados |
| Catálogo | Operativo | Alta/edición, foto validada por MIME y firma binaria, precio, stock, descripción y estado de publicación | Cargar productos, fotos y precios reales |
| Legal | Implementado | Términos, privacidad, cookies por categorías, arrepentimiento, cambios/devoluciones y fuentes oficiales | Revisión final de abogado y contador |
| Cookies | Implementado | Necesarias siempre activas, preferencias opt-in, sin analítica/publicidad, revocación desde footer | Revisar nuevamente si se agrega analítica o marketing |
| SEO/GEO | Preparado | Metadata, canonical, sitemap, robots, Open Graph y `OnlineStore` con dirección/contacto | Dominio final, Search Console, Business Profile e indexación explícita |
| Headers | Endurecido | CSP bloqueante en producción, HSTS, nosniff, frame protection, referrer y permissions policy | Observar reportes tras cada cambio de Google/MP |
| Dependencias | OK | `pnpm audit --prod`: sin vulnerabilidades conocidas | Mantener actualizaciones revisadas y lockfile |
| Contenedor | Preparado | Docker multi-stage, usuario sin privilegios, healthcheck y `.dockerignore` | Elegir Docker o runtime nativo en infraestructura final |

## Migración remota pendiente

Archivo: `supabase/migrations/20260812000000_admin_maintenance_and_rls_hardening.sql`

La conexión de pooler guardada localmente respondió `tenant/user not found` y la CLI enlazada no tiene un `SUPABASE_ACCESS_TOKEN` vigente, por lo que no se ejecutó SQL remoto. No hubo cambios parciales. Para completar:

1. Regenerar `DIRECT_URL` desde Supabase o abrir SQL Editor del proyecto correcto.
2. Aplicar la migración completa en una ventana controlada.
3. Probar Admin > Ingresos y egresos > Mantenimiento con un movimiento manual de capacitación.
4. Confirmar que ventas y pagos automáticos no sean seleccionables.
5. Ejecutar Security Advisor y guardar evidencia.

## Trabajo humano obligatorio antes de cobros reales

1. Validar razón social, CUIT, domicilio, horario y textos con abogado/contador.
2. Cargar catálogo definitivo con fotos propias, precios, unidad y stock reales.
3. Elegir dominio y alinear Render, Supabase Auth, Google OAuth, Mercado Pago, Resend y canonicals.
4. Verificar dominio de Resend con SPF, DKIM y DMARC.
5. Rotar todas las credenciales compartidas durante desarrollo.
6. Cargar credenciales productivas exclusivas de Mercado Pago y confirmar webhook.
7. Ejecutar compra real de bajo monto, factura fiscal por proveedor habilitado y reembolso.
8. Activar `SEO_INDEXING_ENABLED=true` solo después de validar el dominio final.

## Controles ejecutados

- `pnpm run typecheck`: OK.
- `pnpm run lint`: OK.
- `pnpm run security:check`: OK.
- `pnpm audit --prod`: cero vulnerabilidades conocidas.
- `pnpm run build`: OK, 74 rutas generadas.
- Servidor de produccion local: `GET /api/health` HTTP 200.
- Playwright seguridad, privacidad y asistente: 31 controles estables OK. El unico escenario intermitente simula un chunk inexistente; paso en la corrida amplia y fallo una vez al repetir, sin afectar navegacion real.
- Playwright mobile `360x740`: 16 controles OK y 5 omitidos por catalogo vacio/sesion QA ausente; sin desborde horizontal ni exposicion anonima del admin.
- Suite amplia: 115 controles OK y 45 omitidos de forma condicional. Los fallos iniciales del asistente quedaron corregidos al declarar el consentimiento de privacidad en la fixture.
- Docker: el `Dockerfile` queda preparado y validado estaticamente; la descarga de capas/dependencias se interrumpio por conectividad del registro, no por compilacion de la aplicacion.
- `pnpm run assistant:check`: no repetido en esta terminal porque Python no esta disponible en `PATH`; el artefacto no cambio durante este cierre.
- Playwright no destructivo: 107 casos aprobados y 45 omitidos por requerir una sesión o escritura explícita; los dos hallazgos iniciales fueron corregidos y repetidos en forma aislada con resultado OK.
- Docker: runtime listo en 2,5 segundos; healthcheck `200`, Home `200` y acceso anónimo a Admin redirigido (`307`).
- Migración SQL: sintaxis y comportamiento verificados en PostgreSQL 17 aislado; un movimiento manual fue anulado, un pago automático quedó intacto y se generó auditoría.
- Smoke admin autenticado: bloqueado antes de crear el usuario QA porque la red local no pudo resolver/conectar con Supabase (`fetch failed`). No se escribieron datos. Debe repetirse al renovar la conexión del proyecto.
- Readiness productiva: 5/13 controles completos. Permanecen deliberadamente bloqueados dominio/SEO, credenciales productivas, activación final de pagos, Resend, identidad legal, horario de atención y proveedor fiscal.

Este documento no sustituye una auditoría legal, fiscal, PCI ni un pentest externo previo a un lanzamiento de alto volumen.
