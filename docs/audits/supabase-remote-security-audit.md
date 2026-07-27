# Auditoria remota de Supabase

Fecha: 2026-07-27  
Proyecto: `FZAC-Ecommerce`  
Project ref: `gooxgjzetziwnxhuymmx`  
Entorno: Supabase remoto conectado a Render

## Resumen ejecutivo

Se comparo el repositorio con la base remota usando Supabase CLI, Management API,
los asesores oficiales de seguridad/rendimiento y pruebas REST no destructivas.
El proyecto esta saludable y todas las migraciones locales quedaron alineadas con
el historial remoto.

La auditoria encontro y corrigio tres riesgos altos:

1. `finalize_paid_order` podia ser invocada por `anon` y `authenticated`.
2. `product_views` permitia inserciones publicas sin control.
3. La tabla Prisma `users` seguia expuesta a su policy de propietario y conserva
   hashes de contrasena y refresh tokens heredados.

Tambien se reparo el contrato incompatible de `addresses`, que conservaba columnas
y una foreign key de Prisma mientras el backend actual usa Supabase Auth y nombres
snake_case.

## Evidencia antes y despues

| Control | Antes | Despues |
| --- | ---: | ---: |
| Hallazgos del Security Advisor | 11 | 3 |
| `auth_rls_initplan` | 29 | 0 |
| Indices duplicados | 1 | 0 |
| Claves idempotentes duplicadas | 0 | 0 |
| Productos con stock negativo | 0 | 0 |
| RPC de pago disponible para anon | Si | No, HTTP 401 |
| Insert de `product_views` para anon | Si | No, HTTP 401 |
| Migraciones locales/remotas alineadas | No | Si |

## Cambios aplicados

- Se reparo el historial remoto de nueve migraciones heredadas. No se reejecutaron
  seeds ni funciones antiguas sobre el esquema actual.
- Se revoco `EXECUTE` publico de RPC y funciones de trigger sensibles.
- `finalize_paid_order` quedo disponible solo para `service_role`.
- Se fijo `search_path` en funciones marcadas por el asesor.
- Se eliminaron llamadas innecesarias a `is_admin()` desde policies publicas.
- Se retiro la policy de escritura publica de `product_views`.
- Se creo el indice faltante para pedidos `PENDING_ADMIN_APPROVAL`.
- Se elimino la URL de prueba de clavos pendiente.
- Se optimizaron policies para evaluar `(select auth.uid())` una vez por consulta.
- Se elimino el indice duplicado de eventos de pago.
- Se agrego compatibilidad entre `addresses` heredada y el contrato actual.
- La FK obsoleta `addresses.userId -> users.id` fue reemplazada en el flujo actual
  por `addresses.user_id -> profiles.id`.
- Se alinearon `inventory_movements.actor_id`, los timestamps operativos y los
  campos de actor de auditoria requeridos por el flujo de reembolso.
- Las tablas Prisma no utilizadas `users`, `Notification`, `AuditLog` y
  `_prisma_migrations` quedaron sin privilegios para `anon` y `authenticated`.
- El bucket `product-images` limita archivos a 5 MB y a JPG, PNG o WebP.
- Los dos usuarios administradores autorizados estan registrados, confirmados y
  tienen rol `ADMIN`.
- Los asuntos de confirmacion y recuperacion muestran Fortaleza Construcciones.

## Auth y OAuth

- Site URL: URL HTTPS actual de Render.
- Redirects permitidos: Render y localhost, incluidos sus callbacks.
- Google OAuth: habilitado, con client ID y secret configurados.
- Email/password: habilitado, confirmacion de email activa.
- Longitud minima: 8 caracteres con politica de letras, numeros y simbolos.
- Rotacion de refresh token: activa.
- MFA TOTP: disponible.
- SMTP propio: pendiente del dominio/remitente definitivo.
- Have I Been Pwned: no disponible en el plan actual; Supabase respondio HTTP 402.

## Integridad de datos

Las 63 ordenes sin items son registros historicos no pagados:

- 36 `PENDING_PAYMENT`
- 23 `PENDING_TRANSFER`
- 4 `COORDINATE`

No existe ninguna orden pagada sin items. No se eliminaron estos registros porque
la limpieza requiere una politica de retencion y una aprobacion explicita.

La prueba transaccional de direcciones inserto el contrato actual, verifico la
sincronizacion legacy y elimino el registro temporal. Resultado residual: 0 filas.

`supabase db lint --linked --level warning` ya no informa errores de esquema. Solo
queda una advertencia de variable local no leida en `finalize_paid_order`; no afecta
permisos, bloqueo de fila ni transiciones de pago.

## Riesgos pendientes

| Riesgo | Nivel | Tratamiento |
| --- | --- | --- |
| `is_admin()` ejecutable por authenticated | Bajo | Requerido por RLS; solo devuelve el rol de la sesion actual |
| Proteccion HIBP deshabilitada | Medio | Requiere plan Supabase Pro |
| SMTP Auth sin marca/remitente propio | Medio | Configurar luego de verificar dominio |
| 41 avisos de policies permisivas multiples | Bajo | Optimizacion futura; no implican acceso fuera de RLS |
| Tablas Prisma conservadas | Medio | Aisladas; definir retencion antes de eliminarlas |
| Ordenes de prueba pendientes | Bajo | Definir limpieza previa a produccion |
| CAPTCHA deshabilitado | Medio | Requiere Turnstile/hCaptcha y secret dedicado |

## Migraciones del modulo

- `20260727000000_remote_security_hardening.sql`
- `20260727010000_address_schema_compatibility.sql`
- `20260727020000_rls_performance_cleanup.sql`
- `20260727030000_remove_legacy_address_user_fk.sql`
- `20260727040000_legacy_data_and_storage_guard.sql`
- `20260727050000_inventory_actor_compatibility.sql`
- `20260727060000_operational_schema_compatibility.sql`

## Rotacion

El token de Management API usado durante esta auditoria no fue escrito en archivos
versionados. Debe rotarse junto con las demas credenciales antes de produccion.
