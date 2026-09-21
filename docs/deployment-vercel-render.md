# Deploy FZAC: Vercel + Render + Donweb

## Objetivo

Separar la entrega visual del ecommerce de la API sin cambiar funcionalidades ni exponer secretos:

```text
Cliente
  -> tienda.<dominio-fzac> (Vercel / Next.js)
       -> /api/* (rewrite same-origin)
            -> api.<dominio-fzac> o Render
                 -> Supabase / Mercado Pago / Maps / WhatsApp / Resend
```

El navegador sigue consumiendo rutas relativas `/api/*`. Vercel las reenvia al backend cuando `API_PROXY_ORIGIN` esta configurado. Esto evita CORS innecesario y conserva cookies/sesion bajo el origen publico de FZAC.

## Variables nuevas

### Vercel

- `API_PROXY_ORIGIN`: origen HTTPS del backend, sin `/api`.
- `NEXT_PUBLIC_SITE_URL`: URL publica del frontend.
- `FZAC_PUBLIC_SITE_URL`: misma URL publica; se usa como canonica en codigo server-side cuando exista.
- Variables `NEXT_PUBLIC_*` que ya use el frontend.

`API_PROXY_ORIGIN` no es una clave secreta, pero debe apuntar exclusivamente al backend esperado.

### Render

- `FZAC_PUBLIC_SITE_URL`: URL publica final del storefront en Vercel/Donweb. Permite que callbacks, enlaces y redirecciones se generen contra el dominio FZAC aunque el proceso corra en Render.
- `TRUSTED_APP_ORIGINS`: lista separada por comas de origenes HTTPS exactos autorizados para mutaciones web. No usar comodines.

## Secretos: no mover al navegador

Estas variables deben permanecer server-side y no deben convertirse a `NEXT_PUBLIC_*`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_SERVER_KEY`, `GOOGLE_MAPS_SERVER_API_KEY`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_DISTANCE_MATRIX_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_CHECKOUT_PRO_ACCESS_TOKEN`
- `MERCADOPAGO_PRODUCTION_ACCESS_TOKEN`
- `MERCADOPAGO_CARD_ACCESS_TOKEN`
- `MERCADOPAGO_PRODUCTION_CARD_ACCESS_TOKEN`
- secretos de webhook de Mercado Pago
- `RESEND_API_KEY`
- tokens y secretos de WhatsApp Cloud API
- `ASSISTANT_LLM_API_KEY`
- `MARKET_PRICE_FEED_TOKENS_JSON`
- `MARKET_PRICE_CRON_SECRET`
- credenciales privadas de Naranja X
- cualquier clave futura sin prefijo `NEXT_PUBLIC_` que otorgue privilegios de servidor

## Variables publicas permitidas en Vercel

Solo cuando ya esten configuradas en produccion:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
- claves publicas de Mercado Pago `NEXT_PUBLIC_MERCADOPAGO_*`
- `NEXT_PUBLIC_FZAC_WHATSAPP`
- `NEXT_PUBLIC_FZAC_EMAIL`
- flags y metadatos no secretos necesarios para build/render

Las claves de navegador deben seguir restringidas por dominio/origen en cada proveedor.

## Donweb / DNS

No crear registros con destinos inventados. Cuando el dominio final este definido:

1. Asociar el dominio/subdominio del storefront al proyecto de Vercel y copiar exactamente el registro DNS que Vercel solicite.
2. Asociar el subdominio de API al servicio canonico de Render si se desea ocultar `onrender.com`, usando exactamente el destino indicado por Render.
3. Crear esos registros en Donweb.
4. Esperar/verificar certificado TLS en ambos proveedores.
5. Actualizar:
   - `NEXT_PUBLIC_SITE_URL=https://tienda.<dominio-fzac>`
   - `FZAC_PUBLIC_SITE_URL=https://tienda.<dominio-fzac>`
   - `TRUSTED_APP_ORIGINS=https://tienda.<dominio-fzac>`
   - `API_PROXY_ORIGIN=https://api.<dominio-fzac>` o temporalmente la URL HTTPS canonica de Render.
6. Revalidar callbacks y allowlists de terceros.

## Integraciones que requieren revisar el dominio

- Supabase Auth: Site URL y Redirect URLs.
- Mercado Pago: retorno del checkout y URL de webhook.
- Google Maps: HTTP referrers de la browser key; la server key continua server-side.
- Resend: dominio/remitente verificado y DNS SPF/DKIM cuando corresponda.
- WhatsApp Cloud API: URL HTTPS del webhook y token/firma existentes.
- Search Console / SEO: habilitar indexacion solo al finalizar el dominio definitivo.

## Seguridad del split

- Las llamadas del navegador siguen siendo same-origin mediante `/api/*`.
- Las mutaciones aceptan el host actual o un origen exacto configurado; no hay wildcard.
- `API_PROXY_ORIGIN` rechaza HTTP publico y URLs con usuario/password.
- Las respuestas del proxy API no se deben cachear en Vercel.
- El CSP/HSTS/rate limiting/validaciones existentes siguen activos en el backend.
- Las claves privadas no se copian al bundle del frontend.

## Secuencia de cutover

1. Merge solo despues de pasar typecheck, lint, security check, audit y build.
2. Verificar Render `/api/health`.
3. Crear/importar proyecto Vercel desde este repo.
4. Configurar solo variables necesarias para el frontend y `API_PROXY_ORIGIN`.
5. Deploy Preview de Vercel.
6. Probar home, catalogo, login/registro, carrito, checkout, cuenta, admin y endpoints de salud.
7. Configurar dominio de Donweb.
8. Actualizar URLs/callbacks de terceros.
9. Repetir smoke tests con el dominio definitivo.
10. Mantener el servicio Render anterior como rollback hasta cerrar la verificacion.

## Disponibilidad

El frontend en Vercel evita que la primera pantalla dependa del arranque del Web Service de Render. Un Render Free puede suspenderse por inactividad; para un backend siempre activo se requiere un plan de Render sin suspension. Ese cambio de plan implica costo y no debe hacerse automaticamente.
