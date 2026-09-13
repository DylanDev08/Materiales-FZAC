# Auditoría de resiliencia, imágenes, checkout y mobile

Fecha: 2026-09-12  
Alcance: storefront Materiales FZAC, sin migraciones ni cambios destructivos.

## Resultado ejecutivo

- Se conservaron las fotografías reales y autorizadas del catálogo. No se generaron imágenes de producto ni se sustituyeron assets por contenido inventado.
- La presentación de fotos ahora incluye contador, controles anterior/siguiente, gesto horizontal táctil, miniaturas, zoom accesible y cierre con `Escape`.
- Los estantes de productos ahora son carruseles explícitos con controles de 48 px, desplazamiento suave y `scroll-snap`.
- El catálogo deja de montar hasta 120 tarjetas simultáneamente: muestra 24 y permite cargar bloques adicionales de 24. Esto reduce DOM, transferencia de imágenes y longitud inicial en mobile sin ocultar resultados.
- Se creó una experiencia 404 útil con búsqueda directa del catálogo y rutas de recuperación.
- Se agregaron boundaries de error de segmento y global. Los mensajes no filtran excepciones, digest, secretos ni datos técnicos.
- El checkout conserva la lógica productiva existente de stock, envío, idempotencia y Mercado Pago. La mejora agrega garantías visibles, diferencias claras entre medios y una salida segura a retiro o WhatsApp cuando Maps no puede cotizar.
- Cards, detalle y carrito distinguen `CONSULT` de falta de stock: nunca afirman stock validado ni habilitan una compra directa de esos productos.
- La búsqueda pública incluye nombre, marca, SKU, categoría, subcategoría, descripción y especificaciones compatibles, con equivalencias singulares/plurales para los términos auditados.
- El asistente consulta el catálogo real, no conserva snapshots vacíos, pregunta por producto ante consultas genéricas de stock, solicita medidas para paredes de placas y bloquea prompt injection incluso con acentos.
- No se modificaron RLS, Auth, Mercado Pago, stock ni precios. Se corrigió únicamente la categoría histórica de `Clavos`, de Plomería a Ferretería, usando la descripción ya existente como evidencia.

## Seguridad verificada

Controles ejecutados:

- `pnpm run security:check`: correcto.
- Control local de base: 37 tablas públicas exigen `FORCE RLS`.
- APIs administrativas anónimas: bloqueadas.
- Mutaciones cross-origin: bloqueadas.
- Webhook Mercado Pago: firma, deduplicación y persistencia mínima verificadas.
- Superficies privadas: sin caché pública y con `noindex`.
- No se agregaron secretos, variables públicas nuevas ni logs con credenciales.

Supabase Advisor no muestra políticas abiertas en tablas sensibles. Mantiene estos hallazgos preexistentes:

1. `public._prisma_migrations` tiene RLS y no tiene policy. Es una tabla interna y no se abrió una policy pública: [remediación Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
2. `public.is_admin()` es `SECURITY DEFINER` y puede ser invocada por `authenticated`. Actualmente participa en las policies de rol; no se revocó a ciegas para no bloquear el panel: [remediación Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
3. La protección contra contraseñas filtradas está desactivada. Requiere habilitación en Auth desde el dashboard: [guía oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Resiliencia

- `app/not-found.tsx`: respuesta 404 real, búsqueda GET segura y navegación de recuperación.
- `app/error.tsx`: reintento controlado para errores de segmento sin presentar el objeto `Error`.
- `app/global-error.tsx`: fallback autocontenido si falla el layout raíz.

Estos boundaries cubren errores de render/aplicación. Una caída total de Render o DNS no puede ser atendida por código servido desde la misma instancia; para eso se necesitaría una página externa de status/failover.

## Mobile y accesibilidad

- Objetivos táctiles de carrusel, zoom y lightbox de 48 px (44 px en el control compacto del rail).
- Galería con `touch-action: pan-y` para no bloquear el scroll vertical.
- Lightbox con `role="dialog"`, `aria-modal`, textos alternativos y navegación por teclado.
- 404 con inputs de 16 px, acciones apiladas en pantallas compactas y sin scroll horizontal.
- Barras de confianza del checkout desplazables y legibles sin comprimir el contenido.
- Se respeta `prefers-reduced-motion` para el desplazamiento del carrusel.

## Pruebas

- Typecheck: correcto.
- ESLint: correcto.
- Build Next.js de producción: correcto; 74 páginas estáticas/dinámicas recolectadas sin error.
- Unit tests: 8/8 aprobados.
- Smoke de catálogo del asistente: 8/8 escenarios aprobados (cinco búsquedas, cálculo de pared, stock genérico e inyección).
- Playwright `resilience-ux.spec.ts`: 5/5 aprobados.
- Playwright catálogo + resiliencia: 28/28 aprobados.
- Playwright desktop completo: 95 aprobados, 27 omitidos por condiciones QA explícitas, 0 fallos.
- Playwright mobile 360 × 740: 16 aprobados, 6 omitidos por condiciones QA explícitas, 0 fallos.
- La omisión de checkout mutante es intencional: el catálogo importado está en `CONSULT`/stock 0 y no se inventó stock para habilitar la prueba.

Advertencia del entorno local: Node 22.17.0 es inferior al mínimo declarado 22.22.0. El build igualmente finalizó correctamente; el runtime productivo debe mantener el rango definido en `package.json`.

## Archivos de implementación

- `app/not-found.tsx`
- `app/error.tsx`
- `app/global-error.tsx`
- `app/globals.css`
- `components/catalog/product-grid.tsx`
- `components/catalog/product-carousel.tsx`
- `components/cart/cart-page.tsx`
- `components/product/product-card.tsx`
- `components/product/product-buybox.tsx`
- `components/product/product-detail.tsx`
- `components/product/product-gallery.tsx`
- `components/checkout/checkout-form.tsx`
- `lib/db/catalog.ts`
- `lib/assistant/catalog-intelligence.ts`
- `lib/assistant/estimators.ts`
- `lib/assistant/ml-intents.ts`
- `lib/assistant/safety.ts`
- `app/api/assistant/route.ts`
- `styles/experience-innovation.css`
- `tests/e2e/storefront-catalog.spec.ts`
- `tests/e2e/resilience-ux.spec.ts`
- `scripts/assistant-catalog-smoke.mjs`

## Migraciones y datos

- Migraciones: ninguna.
- Escrituras en Supabase: una actualización puntual de categoría sobre `Clavos`; verificada posteriormente como `Ferretería`.
- Productos/precios/stock/proveedores: sin altas, bajas ni cambios de precio, stock o proveedor.
- Imágenes subidas o eliminadas: ninguna.

## Productos históricos

- `Cemento Portland x 50kg`: conserva su imagen real y datos existentes; no requirió corrección verificable.
- `Clavos`: se corrigió la categoría inconsistente `Plomería` → `Ferretería` con base en la descripción almacenada. Sigue sin imagen; no se inventó una.
- `Placa Drywall 12,5mm`: sigue sin imagen. No se copió una foto ni se completó descripción sin una fuente inequívoca.
- La auditoría automática final quedó `READY`: 114 productos activos, 9 categorías activas y 6 hallazgos de contenido no críticos documentados en `catalog-content-audit.md`.

## Google Maps y envíos

- La clave server se resuelve únicamente en código server-side. La clave browser queda limitada a Places/autocomplete.
- La API valida dirección, aplica timeout, deduplicación, caché breve, límite de solicitudes y manejo cerrado de errores.
- Retiro mantiene costo `$0` y no exige dirección.
- Producción responde `422` ante una dirección válida porque faltan parámetros comerciales; no se habilitó un cobro inventado.
- Fórmula sugerida, **no activada**: `ceil(max(mínimo X, base X + km × precio/km X) / redondeo X) × redondeo X`, con radio máximo `X km`. FZAC debe aprobar cada valor antes de configurar las variables.

Variables listas: `FZAC_SHIPPING_BASE_PRICE`, `FZAC_SHIPPING_PRICE_PER_KM`, `FZAC_SHIPPING_MIN_PRICE`, `FZAC_SHIPPING_ROUND_TO`, `FZAC_SHIPPING_MAX_KM`, `FZAC_STORE_ADDRESS`, `GOOGLE_MAPS_SERVER_KEY` y `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`.
