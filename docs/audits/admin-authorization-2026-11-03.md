# Auditoría de autorización administrativa — 2026-11-03

## Alcance y evidencia

Revisión **de solo lectura** sobre GitHub (`integrate/merchant-shipping-security-seo-20261026`) y Supabase de Materiales FZAC (`gooxgjzetziwnxhuymmx`). Esta auditoría no cambia usuarios, contraseñas, roles, RLS, políticas, datos ni configuración productiva.

### Resultado

1. `getApiAdmin()` requiere perfil `ADMIN` y `hasAdminSessionAssurance()`. El cliente con llave privilegiada se obtiene en `getAdminApiContext()` **después** de validar al administrador; las rutas examinadas de productos y pedidos usan ese contexto.
2. `getCurrentUser()` valida la identidad mediante `supabase.auth.getUser()`, no confía en un rol enviado por el navegador.
3. Los perfiles públicos tienen RLS y `private.is_admin()` determina el rol desde la tabla `profiles` con `auth.uid()`. `public.is_admin()` exige además AAL2. En la inspección de permisos, `authenticated` tenía solo `SELECT` directo sobre `public.profiles`; por lo tanto, la política `profiles_update_own` no le da por sí misma permiso SQL de modificar `role`.
4. La aplicación mantiene una lista de correos administrativos como mecanismo adicional de autorización/provisión. `syncUserProfileOnLogin()` puede preservar `ADMIN` existente o asignarlo cuando el email figura en la lista. Esto requiere auditar la titularidad de esa lista y el proceso de revocación; **no** conviene quitarlo sin identificar a los dos administradores autorizados y evaluar el impacto en el acceso.
5. `hasAdminSessionAssurance()` permite AAL2 **o** un dispositivo administrativo confiable. La validez, expiración y revocación de dispositivos deben evaluarse en `trusted-device.ts` y probarse contra sesiones reales.
6. `GET /api/admin/products` consulta todos los productos sin paginación explícita y puede sufrir límite por página de Supabase. No se debe modificar la respuesta sin adaptar el consumidor; posible mejora funcional en un corte posterior.

## Riesgos y decisiones

- No se detectó una vía directa confirmada para que un usuario común eleve `profiles.role` usando el rol Postgres `authenticated` en los permisos observados. Esta comprobación **no sustituye** una prueba de autorización autenticada contra entorno aislado.
- No cambiar RLS ni roles de los siete perfiles existentes (dos marcados ADMIN) durante una auditoría.
- Mantener centralizado `getAdminApiContext()`; no permitir endpoints nuevos que obtengan `getSupabaseAdminClient()` antes de autorización explícita.
- Incorporada prueba de regresión estática `tests/unit/admin-authorization-contract.test.mjs`: rol, MFA, orden del guard y verificación de identidad. No equivale a pentest ni a prueba de ejecución de API.
- Antes de cualquier cambio de roles: inventariar administradores autorizados sin exponer sus correos en logs, verificar MFA/dispositivos confiables, preparar procedimiento de recuperación y ensayar revocación desde sesión ya iniciada.

## Próximos controles

- Pruebas E2E aisladas: usuario sin sesión → 403; usuario con sesión sin rol ADMIN → 403; ADMIN sin MFA/dispositivo autorizado → 403; ADMIN con MFA → operación autorizada.
- Examinar rutas adicionales de `app/api/admin` en busca de acceso privilegiado fuera del guard.
- Auditar `trusted-device.ts` (firma, cookie, expiración y revocación).
- Evaluar paginación administrativa después de comprobar componentes consumidores.

**Publicación:** esta rama es independiente de la PR de checkout y no se ha desplegado.
