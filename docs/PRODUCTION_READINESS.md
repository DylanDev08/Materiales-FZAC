# Preparación productiva de Materiales FZAC

Última revisión: 2026-09-16  
Proyecto Supabase: `FZAC-Ecommerce` (`gooxgjzetziwnxhuymmx`)  
Plataforma observada de producción: Render

Este documento distingue las defensas que están implementadas en código de las
configuraciones que requieren acceso del propietario a servicios externos. No
incluye valores de secretos.

## AUTOMATIZADO / LISTO

### Autenticación y autorización

- Las rutas administrativas resuelven la sesión y el rol en servidor; no aceptan
  el rol enviado por el navegador.
- Los administradores deben alcanzar `aal2` antes de abrir `/admin` o usar
  `/api/admin/*`.
- `/seguridad-admin` proporciona enrolamiento TOTP, QR, challenge y verificación
  con Supabase Auth. Un ADMIN en `aal1` puede completar el enrolamiento sin quedar
  encerrado fuera del panel.
- La recuperación de un administrador no tiene bypass público ni por email: si
  pierde todos sus factores debe intervenir el propietario desde Supabase Auth,
  validar su identidad y retirar el factor perdido.
- Usuarios normales no reciben la obligación de MFA.
- Rutas privadas y administrativas usan `noindex` y `no-store`.

### Base de datos y Supabase

- Las tablas sensibles tienen RLS, permisos reducidos y funciones privilegiadas
  con `search_path` endurecido según las migraciones versionadas.
- `anon` y `authenticated` no tienen lectura directa de `payments`.
- Precios de origen, costos, margen, proveedor interno y procurement permanecen
  fuera del contrato público.
- `payments` e `inventory_movements` no están publicados en Realtime.
- La auditoría del código no encontró consumidores Realtime para `products` ni
  `notifications`; ambas se retiraron de la publicación. Se conservaron
  `chat_conversations`, `chat_messages` y `orders` por criterio conservador.
- `public.users` **no es obsoleta**: contiene datos y sigue referenciada por claves
  foráneas de `user_preferences` y `product_events`. No se preparó ni ejecutó su
  eliminación.
- La consulta del centro de notificaciones administrativas está acotada y usa el
  índice `(target_role, created_at desc)`; no se añadió otro índice redundante.

### Rate limiting y concurrencia

- Los endpoints de auth, asistente, checkout/pagos, arrepentimiento, cotización de
  envío, sugerencias de búsqueda y cron usan una abstracción de rate limiting que
  admite Upstash Redis por HTTP.
- Las claves almacenadas en Redis están derivadas con SHA-256 y no contienen IP,
  email ni identificadores en claro.
- Si Redis no está configurado o no responde, se mantiene el limiter local y se
  emite un warning estructurado sin secretos. Este fallback evita interrumpir el
  servicio, pero **no es global** entre instancias de Render.
- El cron de precios usa lock distribuido cuando Redis está disponible. Si no lo
  está, conserva el lock local existente y reporta explícitamente el fallback.
- Los webhooks de Mercado Pago no reciben un límite agresivo que pueda descartar
  reintentos legítimos.

### Checkout, pagos y stock

- El servidor vuelve a consultar producto, estado, stock y precio; descarta
  precio, subtotal, total y costo de envío enviados por el navegador.
- Se validan cantidades enteras, positivas y acotadas; un carrito vacío o un
  producto inactivo, inexistente, sin stock o a consultar no crea una compra.
- El checkout atómico y sus claves de idempotencia siguen siendo la fuente de
  verdad. Los movimientos de inventario conservan trazabilidad y no se confirma
  stock desde el frontend.
- Las respuestas de pago al cliente pasan por un DTO explícito limitado a
  `status`, `provider`, `amount`, `currency` y `updated_at`. No incluyen payload
  crudo, IDs del proveedor, sesión ni metadata privada.
- El webhook de Mercado Pago conserva verificación de firma, consulta al proveedor,
  asociación con pedido, monto, moneda, `live_mode`, deduplicación e idempotencia.
- Naranja X permanece deshabilitado. Variables de entorno por sí solas no pueden
  exponerlo; el endpoint responde que la integración real no está implementada.

### Emails y observabilidad

- El adaptador de Resend rechaza saltos de línea en cabeceras, escapa contenido
  controlado por usuarios y no registra tokens ni secretos.
- Cada envío usa una clave de idempotencia determinística. Solo se reintentan una
  vez fallas de red, `429` y `5xx`, reutilizando la misma clave.
- Checkout, cron y webhook de pagos emiten eventos JSON con correlation/request ID.
- El logger rechaza campos sensibles como authorization, password, token, secret,
  cookie, tarjeta, payload crudo o service role.

### SEO y navegación histórica

- Robots, sitemap, canonical, Open Graph, Twitter cards, Product/Organization
  JSON-LD y breadcrumbs ya están presentes en las páginas públicas aplicables.
- Admin, auth, checkout y cuenta no se indexan.
- Redirects permanentes sin cadena:
  - `/productos.html` → `/productos`
  - `/carrito.html` → `/carrito`
  - `/mis-pedidos.html` → `/cuenta/pedidos`
  - `/cliente-login.html` → `/login`

### Clasificación de rutas API

| Clase | Rutas / mecanismo |
| --- | --- |
| PUBLIC | health, catálogo/búsqueda, asistente, cotización y auth; schemas, límites y respuestas acotadas según el endpoint |
| AUTHENTICATED | cuenta, carrito, pedidos, checkout, medios de pago y arrepentimiento; sesión Supabase resuelta en servidor |
| ADMIN | todo `/api/admin/*`; sesión, rol ADMIN en DB y `aal2`; mutations aplican controles de origen cuando corresponde |
| INTERNAL/CRON | `/api/cron/market-prices`; secret server-side con comparación segura, rate limit y lock distribuido |
| WEBHOOK | aliases de Mercado Pago y WhatsApp; autenticidad propia del proveedor, límites de body, deduplicación e idempotencia |

### CI/CD

El workflow de calidad usa instalación con lockfile y ejecuta:

1. typecheck;
2. lint;
3. tests unitarios;
4. validación del asistente;
5. security check sobre el estado final de las migraciones;
6. auditoría de dependencias de severidad alta;
7. build.

El script de seguridad comprueba el orden final de grants/revokes y que
`payments`/`inventory_movements` no vuelvan a Realtime; no depende de una sola
migración histórica.

## REQUIERE CONFIGURACIÓN MANUAL

### 1. Protección de contraseñas filtradas

El advisor de Supabase la reporta desactivada. En el dashboard del proyecto:

1. abrir **Authentication → Sign In / Providers → Email**;
2. activar **Leaked password protection**;
3. guardar y probar registro/cambio de contraseña con una cuenta de QA.

Referencia: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

El aviso informativo sobre `_prisma_migrations` con RLS y sin policies es esperado:
la tabla queda cerrada a clientes. No se debe crear una policy pública solo para
silenciar el advisor.

### 2. Enrolamiento MFA de administradores

- Cada administrador debe iniciar sesión, abrir `/seguridad-admin`, escanear el QR
  en su aplicación TOTP y verificar un código.
- Guardar los métodos de recuperación fuera del repositorio.
- Probar un segundo factor de respaldo antes de retirar el dispositivo principal.

### 3. Rate limiting y lock global

Configurar en Render:

- `UPSTASH_REDIS_REST_URL`: endpoint HTTPS del Redis compatible con Upstash.
- `UPSTASH_REDIS_REST_TOKEN`: token server-side para ejecutar comandos REST.

Hasta entonces el servicio funciona con fallback local, que no coordina distintas
instancias.

### 4. Google Maps y tarifa de envío

- La key browser debe estar restringida por HTTP referrer y solo habilitada para
  Places/Autocomplete.
- La key server debe permanecer en Render, restringida a las APIs necesarias y,
  si la plataforma ofrece una IP de salida estable, también por IP.
- La clave server observada anteriormente fue rechazada por restricciones de
  referrer al intentar uso server-side. Debe separarse de la browser key.
- No se activó una tarifa inventada. Sin fórmula comercial completa el endpoint
  falla cerrado y el checkout ofrece retiro/coordinación en lugar de cobrar un
  envío falso.

Variables esperadas: `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`,
`GOOGLE_MAPS_SERVER_KEY`, `FZAC_STORE_ADDRESS`,
`FZAC_SHIPPING_BASE_PRICE`, `FZAC_SHIPPING_PRICE_PER_KM`,
`FZAC_SHIPPING_MIN_PRICE`, `FZAC_SHIPPING_ROUND_TO` y
`FZAC_SHIPPING_MAX_KM`.

### 5. Operación externa

- Confirmar política y retención de backups/PITR de Supabase y realizar una prueba
  documentada de restauración.
- Verificar dominio y variables del servicio Render, health check y rollback.
- Registrar dominio/sitemap en Search Console.
- Confirmar credenciales productivas, webhook y cuenta receptora de Mercado Pago
  con una compra controlada manual; los tests automáticos no compran en producción.
- Verificar dominio remitente de Resend, SPF/DKIM/DMARC, entrega, rebote y alertas.
- Completar configuración fiscal, términos, privacidad, devoluciones y datos legales
  con asesoramiento competente.

## VARIABLES NUEVAS

Solo se agregaron estos nombres:

| Variable | Propósito |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | endpoint del rate limiter y lock distribuidos |
| `UPSTASH_REDIS_REST_TOKEN` | credencial server-side de Redis HTTP |

No deben exponerse con prefijo `NEXT_PUBLIC_` ni versionarse con valores reales.

## DECISIONES DELIBERADAS Y RIESGOS RESIDUALES

- No se retiró `'unsafe-inline'` de CSP. El árbol todavía contiene estilos inline,
  JSON-LD, scripts de recuperación y scripts de terceros. Una migración segura
  requiere nonce por request, propagación SSR y pruebas de hydration, Mercado Pago
  y estilos; retirarlo parcialmente rompería producción. `unsafe-eval` sigue fuera
  de la CSP productiva.
- No se eliminó `public.users` por sus claves foráneas activas.
- No se eliminaron chat ni orders de Realtime sin evidencia adicional.
- No se crearon índices basados únicamente en advisors de “unused index”.
- El retry de email reduce fallas transitorias, pero no reemplaza una cola durable.
- La cobertura concurrente real de DB y Mercado Pago requiere un entorno de staging
  aislado y credenciales de prueba; no se ejecutan mutaciones financieras contra
  producción.
- El runtime local usado en esta auditoría es Node 22.17.0; CI exige Node 22.22.0,
  que es el mínimo declarado por el proyecto.

## TESTS DE LANZAMIENTO

### Última ejecución local (2026-09-16)

- `pnpm install --frozen-lockfile`: OK.
- `pnpm run typecheck`: OK.
- `pnpm run lint`: OK.
- `pnpm test`: 15/15 OK.
- `pnpm run assistant:check`: OK, 140 documentos y 32 casos de evaluación.
- `pnpm run security:check`: OK, 37 tablas públicas verificadas con FORCE RLS.
- `pnpm run build`: OK, 76 páginas generadas.
- `pnpm exec playwright test`: 194 OK, 36 omitidos por condiciones explícitas,
  0 fallos. Incluyó Chromium desktop, iPhone 13, Pixel 7, Galaxy S20 y 360 px.

La máquina local emitió el warning documentado por usar Node 22.17.0; el workflow
de CI ejecuta Node 22.22.0, versión soportada por el proyecto.

### Automatizados

- [ ] `corepack pnpm install --frozen-lockfile`
- [ ] `corepack pnpm run lint`
- [ ] `corepack pnpm run typecheck`
- [ ] `corepack pnpm test`
- [ ] `corepack pnpm run assistant:check`
- [ ] `corepack pnpm run security:check`
- [ ] `corepack pnpm run build`
- [ ] `corepack pnpm exec playwright test`

### Manuales, en staging antes de promover

- [ ] Registrar y autenticar usuario normal; confirmar que nunca abre `/admin`.
- [ ] Enrolar TOTP como ADMIN, comprobar bloqueo en `aal1` y acceso en `aal2`.
- [ ] Perder/retirar un factor de QA y ensayar recuperación administrativa.
- [ ] Ver catálogo, carrito y checkout en desktop y mobile sin scroll horizontal.
- [ ] Intentar manipular precio, subtotal, envío y cantidades desde DevTools.
- [ ] Simular stock insuficiente y dos checkouts concurrentes del mismo SKU.
- [ ] Probar retiro (`$0`) y delivery válido, incompleto, fuera de radio y falla Maps.
- [ ] Ejecutar escenarios webhook Mercado Pago con credenciales sandbox.
- [ ] Confirmar que el cliente solo recibe el DTO seguro de pago.
- [ ] Probar entrega/rebote de emails sin exponer enlaces mágicos en logs.
- [ ] Verificar 308 de las cuatro URLs legacy y ausencia de loops.
- [ ] Revisar advisor de seguridad Supabase después de cada nueva migración.
- [ ] Confirmar que `origin/main`, SHA desplegado y build de Render coinciden.
