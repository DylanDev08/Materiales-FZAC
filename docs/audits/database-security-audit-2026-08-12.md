# Auditoria de seguridad e integridad de base de datos

Fecha: 2026-08-12  
Repositorio: `Materiales-FZAC-E-Commerce`  
Entorno validado: codigo local y PostgreSQL 17 aislado en Docker  
Supabase remoto: pendiente de verificacion autenticada

## Resumen ejecutivo

La revision encontro debilidades reales en integridad, autorizacion y consistencia
transaccional. Los controles del frontend y Zod eran correctos como primera capa,
pero varias invariantes comerciales podian evitarse escribiendo directamente en
la base o mediante dos solicitudes concurrentes.

Se preparo una migracion no destructiva que conserva los registros existentes,
refuerza RLS, agrega indices faltantes y protege los nuevos cambios mediante
constraints y triggers. Tambien se corrigieron los accesos por email historico,
la sincronizacion parcial del carrito, las transiciones administrativas de
pedidos y el registro previo de webhooks de Mercado Pago.

La secuencia completa de migraciones y el smoke test transaccional pasan desde
una base vacia. No se modifico la base remota porque la sesion actual de Supabase
CLI no dispone de `SUPABASE_ACCESS_TOKEN`; aplicar cambios sin confirmar el
proyecto enlazado seria un riesgo innecesario.

## Hallazgos y tratamiento

| Area | Riesgo | Evidencia | Accion |
| --- | --- | --- | --- |
| Propiedad de pedidos | Alto | Cuenta y comprobantes aceptaban coincidencia de email ademas de `user_id` | Se exige propietario por UUID o rol ADMIN |
| Carrito persistido | Alto | El `upsert` no eliminaba filas quitadas en otro dispositivo | RPC atomica `sync_user_cart`, con bloqueo por usuario y reemplazo completo |
| Transiciones de pedidos | Alto | Aprobar/rechazar actualizaba orden, auditoria y notificaciones por separado | RPC atomica `admin_transition_order` |
| Notas de compra | Medio | Rechazar una orden reemplazaba las notas originales del cliente | Campos de cancelacion separados e inmutabilidad del snapshot comercial |
| Webhook de pagos | Alto | El pago podia procesarse aunque fallara el registro de auditoria | Limite de 64 KiB, validacion JSON y fail-closed antes de procesar |
| Integridad financiera | Alto | Monto de payment/order e items dependian principalmente del backend | Triggers y checks para total, moneda, cantidad, subtotal e IDs de proveedor |
| Idempotencia | Alto | IDs de proveedor duplicables si la aplicacion sufria concurrencia | Indices unicos condicionales y RPCs serializadas |
| Catalogo | Medio | URLs, precios, SKU, slug, galeria y ciclos de categorias no estaban protegidos en DB | Validaciones equivalentes en Zod y triggers SQL |
| Roles operativos | Alto | Algunos RPC validaban que el actor existiera, no que fuera ADMIN | Trigger comun para actores de proveedores, compras, inventario y finanzas |
| Notificaciones | Medio | El propietario podia modificar contenido, destinatario y enlace | Solo puede cambiar estado de lectura fuera del backend privilegiado |
| Resenas | Medio | Un cliente podia intentar insertar `approved=true` | Toda resena de cliente entra a moderacion |
| Analitica publica | Medio | Eventos de busqueda podian insertarse directamente desde cliente | Escritura publica eliminada; queda solo el camino controlado de servidor |
| Funciones SQL | Alto | Una funcion `SECURITY DEFINER` heredaba EXECUTE publico | Revocacion explicita y privilegios por defecto privados |
| RLS | Alto | Algunas policies privilegiadas quedaban asignadas implicitamente a `public` | Policies sensibles limitadas a `authenticated` y lectura publica explicita |
| Rendimiento DB | Medio | 32 foreign keys no tenian indice de apoyo | Se agregaron indices; el replay local termina con 0 FKs simples sin indice |
| Limites por usuario | Medio | Direcciones/favoritos usaban count + insert susceptible a carrera | Advisory lock transaccional y limite en trigger |

## Migracion

Archivo principal:
`supabase/migrations/20260812010000_database_integrity_hardening.sql`

La migracion:

- No elimina tablas ni filas.
- Usa checks `NOT VALID` para no bloquear por registros historicos; todas las
  escrituras nuevas o modificadas quedan protegidas.
- Mantiene `service_role` exclusivamente en servidor.
- Fuerza RLS en las tablas de aplicacion del esquema `public`.
- Conserva lectura anonima solo para catalogo activo y configuracion marcada
  expresamente como publica.
- Revoca RPC financieras y administrativas para `public`, `anon` y
  `authenticated`.
- Agrega indices para ownership, joins, panel administrativo y claves foraneas.

Tres migraciones antiguas de compatibilidad fueron hechas condicionales para que
el historial pueda reproducirse tanto sobre el esquema Prisma heredado como
sobre una instalacion limpia:

- `20260727010000_address_schema_compatibility.sql`
- `20260727050000_inventory_actor_compatibility.sql`
- `20260727060000_operational_schema_compatibility.sql`

## Pruebas realizadas

La prueba `supabase/tests/database_integrity_smoke.sql` se ejecuta dentro de una
transaccion y finaliza con `ROLLBACK`. Comprueba:

- Creacion e idempotencia exacta de checkout.
- Rechazo de cambio de propietario y monto de pago.
- Rechazo de configuracion sensible publica.
- Rechazo de actor operativo no administrador.
- Ciclos de categorias y URLs inseguras de productos/galeria.
- Formato de contacto.
- Limite concurrente de direcciones.
- Sincronizacion y eliminacion completa del carrito.
- Inmutabilidad de notificaciones y moderacion de resenas.
- Aprobacion/rechazo atomicos con auditoria y notificaciones.
- FORCE RLS, privilegios de RPC y ausencia de escritura publica del catalogo.

Resultados locales:

- Replay completo de migraciones: OK.
- Smoke test SQL: OK.
- Foreign keys simples sin indice: 0.
- `pnpm run security:check`: OK.
- `pnpm audit --prod`: sin vulnerabilidades conocidas.

## Riesgos pendientes

| Riesgo | Nivel | Proximo paso |
| --- | --- | --- |
| Migracion aun no aplicada/verificada en Supabase remoto | Alto | Autenticar Supabase CLI, ejecutar `migration list`, `db lint` y luego `db push` con revision previa |
| Estado de datos historicos remoto desconocido | Alto | Ejecutar consultas preflight de duplicados y filas incompatibles antes del push |
| Rate limiter en memoria por instancia | Medio | Adoptar un almacen distribuido antes de escalar horizontalmente en Render |
| Checks nuevos quedan `NOT VALID` para filas historicas | Medio | Corregir datos detectados y ejecutar `VALIDATE CONSTRAINT` por lotes |
| Tablas Prisma heredadas | Medio | Mantener aisladas; definir retencion antes de cualquier eliminacion |
| Rotacion de credenciales | Alto para produccion | Rotar todas las claves compartidas antes de habilitar cobros reales |

## Procedimiento remoto recomendado

1. Autenticar Supabase CLI sin escribir el token en el repositorio.
2. Confirmar el project ref enlazado.
3. Ejecutar `pnpm dlx supabase migration list --linked`.
4. Ejecutar `pnpm dlx supabase db lint --linked --level warning`.
5. Revisar duplicados que impedirian indices unicos.
6. Aplicar con `pnpm dlx supabase db push --linked` en una ventana controlada.
7. Repetir lint, advisors y pruebas funcionales de auth, carrito y checkout.
8. Verificar logs antes de desplegar el codigo que consume las RPC nuevas.

No se debe desplegar el codigo de carrito o transiciones administrativas antes
de que la migracion remota este aplicada: las rutas responden 503 de forma
controlada si las RPC aun no existen.
