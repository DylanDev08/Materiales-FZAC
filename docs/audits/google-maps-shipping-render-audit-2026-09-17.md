# Auditoría Render, Google Maps y shipping — 2026-09-17

Alcance: rama `chore/production-readiness-20260916`, PR #4 y producción Render.
No se muestran valores de secretos y no se realizaron pedidos ni pagos.

## A. Render

Estado verificable desde el repositorio y el endpoint productivo:

- Servicio declarativo: `materiales-fzac`.
- Branch declarada: `main`.
- Producción respondió `200` y reportó el SHA
  `2ca58bcc3fb613f8361a3e77549623d9dc2e83ff`.
- Runtime: Node; versión declarada `22.22.0`.
- Build: Corepack + instalación pnpm con lockfile + build Next.js.
- Start: `pnpm run start` sobre el puerto provisto por Render.
- Health check: `/api/health`.
- Auto deploy: commit sobre la branch declarada.

No hay credenciales de Render disponibles en el entorno de auditoría. Por eso no
se puede certificar que el dashboard no haya divergido de `render.yaml`, ni leer la
presencia individual de secretos `sync: false`. Requiere validación manual.

### Variables relevantes

| Variable | Declaración | Superficie | Estado comprobable |
| --- | --- | --- | --- |
| `GOOGLE_MAPS_SERVER_KEY` | `sync: false` | server | activa en código; Routes devolvió distancia real en Render |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | `sync: false` | browser | activa en código; presencia real del dashboard pendiente |
| `FZAC_STORE_ADDRESS` | declarada | server | activa; valor no duplicado |
| `FZAC_SHIPPING_BASE_PRICE` | `sync: false` | server | tarifa productiva no válida/completa |
| `FZAC_SHIPPING_PRICE_PER_KM` | `sync: false` | server | tarifa productiva no válida/completa |
| `FZAC_SHIPPING_MIN_PRICE` | `sync: false` | server | presencia individual pendiente |
| `FZAC_SHIPPING_ROUND_TO` | declarada | server | activa |
| `FZAC_SHIPPING_MAX_KM` | declarada | server | activa |
| `RESEND_API_KEY` | `sync: false` | server | presencia real pendiente |
| `SUPABASE_SERVICE_ROLE_KEY` | `sync: false` | server | presencia real pendiente |
| `MERCADOPAGO_ACCESS_TOKEN` | `sync: false` | server | presencia real pendiente |

No hay aliases Google duplicados en `render.yaml`. Sí existe el alias histórico
`PAYMENT_ENABLED` junto a `PAYMENTS_ENABLED`; su compatibilidad está implementada
en pagos y no se modificó en esta auditoría.

## B. Google Maps Browser Key

Uso real: el componente cliente de checkout carga Maps JavaScript con la librería
`places` y construye `google.maps.places.Autocomplete`. No renderiza un mapa ni
llama Routes, Geocoding o Distance Matrix directamente.

APIs necesarias:

- Maps JavaScript API.
- Places API usada por el widget legacy `Autocomplete`.

Restricción recomendada: HTTP referrers / Websites con localhost, 127.0.0.1 y la
URL de Render. Agregar los dominios comerciales únicamente cuando estén activos.
Places API (New) no es necesaria mientras no se migre a `PlaceAutocompleteElement`.

Referrers exactos recomendados:

- `http://localhost:*/*`
- `http://127.0.0.1:*/*`
- `https://materiales-fzac-8xmp.onrender.com/*`
- Futuro, solo cuando el dominio esté activo: `https://materialesfzac.com/*`
- Futuro, solo cuando el dominio esté activo: `https://www.materialesfzac.com/*`

Referencias oficiales: [Google Maps Platform security guidance](https://developers.google.com/maps/api-security-best-practices)
y [Place Autocomplete legacy](https://developers.google.com/maps/documentation/javascript/legacy/place-autocomplete).

## C. Google Maps Server Key

Uso real: `lib/shipping/quote.ts`, marcado `server-only`, lee únicamente
`GOOGLE_MAPS_SERVER_KEY`. La implementación llama exclusivamente:

`POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`

con `X-Goog-Api-Key` y FieldMask mínimo
`status,condition,distanceMeters,duration`.

Referencia oficial: [Compute Route Matrix](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix).

La restricción declarada por el propietario es IP/CIDR de egreso de Render y Routes
API únicamente. No pudo inspeccionarse directamente Google Cloud, pero una prueba
productiva devolvió distancia real y no reportó rechazo de credencial.

Aliases retirados del código activo y `.env.example`:

- `GOOGLE_MAPS_SERVER_API_KEY`
- `GOOGLE_MAPS_API_KEY`
- `GOOGLE_DISTANCE_MATRIX_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`

### Inventario de nombres

| Variable | Referencias relevantes | Superficie / uso | Estado | Riesgo residual |
| --- | --- | --- | --- | --- |
| `GOOGLE_MAPS_SERVER_KEY` | `lib/shipping/quote.ts`, `.env.example`, `render.yaml` | servidor / Routes | activa y única | dashboard manual |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | `components/checkout/checkout-form.tsx`, `.env.example`, `render.yaml` | cliente / Maps JS + Places | activa y única | restringir por referrer |
| `GOOGLE_MAPS_SERVER_API_KEY` | documentación histórica y `.env` local ignorado | ninguno en runtime | legacy | confusión local |
| `GOOGLE_MAPS_API_KEY` | `.env` local ignorado | ninguno en runtime | legacy | selección errónea si reaparece |
| `GOOGLE_DISTANCE_MATRIX_KEY` | `.env` local ignorado | ninguno en runtime | legacy | API legacy innecesaria |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | documentación histórica y `.env` local ignorado | ninguno en runtime | legacy | configuración browser duplicada |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY` | guard de seguridad/documentación | ninguno en runtime | legacy | ninguno mientras el guard permanezca |

`scripts/security-check.mjs` menciona nombres legacy únicamente para impedir que
vuelvan al código activo. `CONTEXT.md` y una auditoría anterior conservan referencias
históricas; no participan del build ni de la selección de credenciales.

El `.env` local ignorado todavía contiene aliases y dos definiciones duplicadas.
Debe limpiarse manualmente sin copiar valores. Los documentos históricos que los
mencionan no participan de la ejecución.

## D. Shipping

Flujo confirmado:

```text
checkout browser
  -> POST /api/shipping/quote
  -> sesión + validación + límites
  -> servicio server-only
  -> Routes API
  -> distancia validada
  -> tarifa server-side
  -> respuesta pública acotada
```

Correcciones aplicadas:

- La ruta requiere sesión además de límite por IP y usuario.
- El JSON queda limitado a 8 KiB y rechaza campos extra.
- No se llama Google si la clave, la dirección de origen o cualquiera de las
  cinco variables de tarifa falta o es inválida.
- No existen fallbacks comerciales silenciosos.
- Se rechazan negativos, NaN, infinito, distancia cero y desbordes.
- El radio máximo se verifica antes de producir un importe.
- Cache de éxito: cinco minutos; cache de fallo: treinta segundos.
- Cache acotado a 500 entradas y cotizaciones pendientes acotadas a 64.
- Solicitudes simultáneas idénticas se deduplican.
- Timeout server-side: siete segundos; no hay retry automático que multiplique
  costos frente a `429` o errores transitorios.
- Errores de Google se convierten a mensajes públicos; no se serializan payloads
  internos, claves, proyectos ni razones técnicas.

Producción actual devolvió distancia positiva pero `422` porque la tarifa no está
completa o no es válida. No es posible determinar desde afuera cuál variable
privada falta; debe revisarse el dashboard.

## E. Checkout

El costo mostrado en el browser es informativo. `createCheckout`:

1. vuelve a consultar productos y precios en Supabase;
2. valida stock y cantidades;
3. vuelve a llamar al cotizador server-side para delivery;
4. calcula subtotal, envío y total;
5. pasa esos valores al RPC atómico y a Mercado Pago.

`shipping_cost`, `subtotal`, `total` y precios enviados por DevTools no forman
parte del schema aceptado. Un delivery sin cotización disponible falla y no crea
un pago con envío cero.

## F. Vulnerabilidades

### Critical

- Ninguna confirmada.

### High — corregidas en la rama

- Endpoint de cotización anónimo podía generar consumo de Google.
- La implementación consultaba Routes aun cuando faltaba la tarifa.
- Aliases server-side permitían seleccionar accidentalmente una key incorrecta.

### Medium — corregidas en la rama

- Fallbacks silenciosos para mínimo, redondeo y radio.
- Cotizaciones pendientes sin tope interno.
- FieldMask mayor al necesario para un único origen/destino.
- Documentación desactualizada sobre el error de referrer ya resuelto.

### Low / residual

- Rate limiting y concurrencia global dependen de configurar Upstash; sin él el
  fallback es por instancia.
- Cache y deduplicación son por proceso. El rate limit distribuido sigue siendo
  el control entre instancias.
- El `.env` local ignorado conserva aliases antiguos y duplicados.
- Las restricciones de Google Cloud y el inventario real de Render requieren
  verificación manual con las cuentas del propietario.

No se confirmó SSRF: la URL de Google es constante. Tampoco se confirmó bypass de
tarifa, exposición de claves, CORS abierto, header injection ni uso de totales del
cliente.

## G. Archivos modificados

- `lib/shipping/service.ts`: servicio testeable, cálculo, cache, timeout y errores.
- `lib/shipping/quote.ts`: wrapper server-only con variables canónicas.
- `app/api/shipping/quote/route.ts`: autenticación y JSON estricto.
- `components/checkout/checkout-form.tsx`: browser key canónica única.
- `lib/validations/checkout.ts`: dirección plausible y sanitización compartida.
- `.env.example`: contrato de variables sin aliases.
- `scripts/security-check.mjs`: detecta claves Google y regresiones de separación.
- `tests/unit/shipping.test.mjs`: pruebas sin red real.
- `tests/e2e/shipping-quote.spec.ts`: validación de sesión y payload.
- `tests/e2e/production-integrity.spec.ts`: direcciones adversariales en checkout.
- `docs/audits/shipping-setup.md`: procedimiento actualizado.
- `docs/PRODUCTION_READINESS.md`: estado actual de Routes.

## H. Validaciones

- `pnpm install --frozen-lockfile`: OK.
- Typecheck: OK.
- Lint: OK.
- Build: OK; 76 rutas/páginas generadas.
- Security check estático: OK.
- Comprobación de seguridad de base: OK; 37 tablas públicas con FORCE RLS.
- Unit tests: 36/36 OK.
- Playwright relevante: 51 passed, 4 skipped, 0 failed. Los cuatro omitidos son
  escenarios autenticados con escritura que exigen habilitación explícita de QA.
- Escaneo del bundle: la key server, su nombre y el endpoint Routes no aparecen
  en archivos cliente. La key browser sí aparece, como corresponde a una key
  pública restringida por referrer.
- `git diff --check`: OK.
- Entorno local: Node 22.17 emitió advertencia de engine; Render/CI declaran
  Node 22.22.0, que satisface el proyecto y el soporte vigente de Supabase.

## I. Acciones manuales del propietario

1. En Render, abrir `materiales-fzac` > Environment y comparar cada nombre con
   `render.yaml`; eliminar aliases Google solo después de confirmar que no los usa
   otro servicio. No copiar valores a documentación ni commits.
2. Confirmar `FZAC_STORE_ADDRESS` y completar las cinco variables comerciales de
   tarifa con valores aprobados. Mientras falte una, delivery falla cerrado y no
   inventa un costo.
3. En Google Cloud > APIs & Services > Credentials, abrir la browser key, aplicar
   restricción Websites, cargar los referrers de la sección B y permitir solamente
   Maps JavaScript API y Places API usada por el widget actual.
4. Abrir la server key y confirmar restricción por los CIDR de egreso de Render y
   restricción de API a Routes API. La llamada actual funciona, pero el dashboard
   no estuvo accesible desde esta auditoría.
5. Limpiar aliases y definiciones duplicadas del `.env` local sin compartir sus
   valores. Conservar únicamente los dos nombres canónicos.
6. Configurar Upstash si se necesita rate limit global entre instancias; sin él
   existe fallback local y autenticación obligatoria, pero no un contador global.
7. Después de aprobar y mergear el PR, esperar el deploy de Render, comprobar
   `/api/health` y hacer una cotización delivery autenticada sin completar una
   compra. Revisar métricas y cuotas de Routes API.

## J. Variables de entorno

- `GOOGLE_MAPS_SERVER_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
- `FZAC_STORE_ADDRESS`
- `FZAC_SHIPPING_BASE_PRICE`
- `FZAC_SHIPPING_PRICE_PER_KM`
- `FZAC_SHIPPING_MIN_PRICE`
- `FZAC_SHIPPING_ROUND_TO`
- `FZAC_SHIPPING_MAX_KM`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`

## K. Git / PR

- Branch: `chore/production-readiness-20260916`.
- PR: #4.
- Commit funcional: `b108775016f392c5c87b1177339c0350ad4f84ab`.
- GitHub Actions: `FZAC quality gate` run 39, `success`.
- Producción y `origin/main`: `2ca58bcc3fb613f8361a3e77549623d9dc2e83ff`.
- Render `/api/health`: `200`, servicio `materiales-fzac`, mismo SHA de `main`.
- No se modifica ni despliega `main`.
- Este informe se incorpora en un commit posterior exclusivamente documental.
