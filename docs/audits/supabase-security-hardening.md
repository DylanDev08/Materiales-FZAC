# Cierre de seguridad Supabase

Proyecto auditado: `FZAC-Ecommerce` (`gooxgjzetziwnxhuymmx`). Fecha: 15 de septiembre de 2026.

## `public.is_admin()`

Se aplicó una migración compatible con las policies existentes:

- `public.is_admin()` conserva nombre y firma, pero ahora es `SECURITY INVOKER`, `STABLE` y usa `search_path = ''`.
- La lectura privilegiada de `profiles` se movió a `private.is_admin()`, fuera del schema expuesto por Data API.
- El helper privado es `SECURITY DEFINER`, tiene referencias calificadas (`public.profiles`, `auth.uid()`) y `search_path = ''`.
- Se revocó ejecución a `PUBLIC` y `anon`; solo `authenticated` y `service_role` tienen los permisos mínimos necesarios.
- El usuario autenticado normal devuelve `false`; el rol administrativo de base sigue funcionando para RLS.
- La autorización del panel y de las APIs continúa usando el email server-side permitido, no `user_metadata` ni un rol enviado por el cliente.

El Security Advisor dejó de reportar la función `SECURITY DEFINER` expuesta.

## `_prisma_migrations`

Decisión: mantener la tabla técnica en su ubicación actual para no romper Prisma/migraciones y aceptar el aviso informativo.

- RLS está activo.
- No hay policies públicas.
- `anon` no tiene `SELECT`.
- `authenticated` no tiene `SELECT`.
- No se creó una policy artificial para silenciar el linter.

El advisor conserva `rls_enabled_no_policy` como nivel `INFO`. En este caso describe justamente una tabla técnica cerrada; no representa exposición de datos.

## Leaked Password Protection

Estado: pendiente de activación manual. Las herramientas disponibles permiten consultar el advisor, pero no mutar esta opción de Auth de forma autenticada. El advisor todavía devuelve `auth_leaked_password_protection` en nivel `WARN`.

Pasos exactos:

1. Abrir Supabase Dashboard y seleccionar **FZAC-Ecommerce** (`gooxgjzetziwnxhuymmx`).
2. Ir a **Authentication** → **Providers** (o **Sign In / Providers**, según la versión del dashboard).
3. Abrir el proveedor **Email** y la sección **Password security**.
4. Activar **Leaked password protection**.
5. Guardar.
6. Volver a **Database** → **Advisors** → **Security** y confirmar que desapareció `auth_leaked_password_protection`.
7. Probar registro y cambio de contraseña con una contraseña segura. Las contraseñas conocidas como comprometidas deben rechazarse; un login existente no comprometido no debería verse afectado.

Referencia oficial: <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>
