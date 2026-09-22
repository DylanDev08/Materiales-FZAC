# Cutover a dominio definitivo — Materiales FZAC

Este checklist se usa cuando el dominio real ya esté comprado y definido.

## Arquitectura objetivo

```text
tienda.<dominio>  -> Vercel
/api/*            -> rewrite same-origin
api.<dominio>     -> Render
Supabase / Mercado Pago / Maps / Resend / Meta detrás del backend
```

También puede usarse el dominio raíz para la tienda; lo importante es mantener un único origen público canónico.

## Orden de cambio

1. Asociar el dominio de tienda al proyecto Vercel canónico.
2. Asociar `api.<dominio>` al servicio Render canónico si se usará subdominio API.
3. Esperar TLS válido.
4. Configurar en Vercel y Render:
   - `FZAC_PUBLIC_SITE_URL=https://...`
   - `NEXT_PUBLIC_SITE_URL=https://...`
   - `TRUSTED_APP_ORIGINS=https://...`
   - `API_PROXY_ORIGIN=https://api....` o Render HTTPS canónico.
5. Configurar Turnstile para el hostname real:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `TURNSTILE_SECRET_KEY`
6. Supabase Auth:
   - Site URL = dominio real;
   - redirect URLs = solo producción necesaria + desarrollo autorizado;
   - verificar TOTP de todos los admins;
   - activar Leaked Password Protection si el plan/configuración lo permite.
7. Mercado Pago:
   - success/pending/failure URLs al dominio real;
   - webhook HTTPS productivo;
   - secret de webhook del ambiente correcto.
8. Google:
   - browser key restringida al hostname real;
   - redirect OAuth exacto;
   - server key sin exposición al cliente.
9. Resend:
   - dominio verificado;
   - SPF/DKIM correctos;
   - remitente productivo.
10. Meta/WhatsApp:
   - webhook definitivo;
   - verify token/app secret server-side.
11. Ejecutar `pnpm release:audit`.
12. Smoke test:
   - home;
   - catálogo;
   - login;
   - registro;
   - MFA admin;
   - carrito;
   - reserva de stock;
   - checkout;
   - webhook;
   - orden/ticket;
   - admin;
   - upload imagen;
   - mobile.
13. Recién después activar `SEO_INDEXING_ENABLED=true`.

## No hacer

- no apuntar DNS a proyectos Vercel duplicados;
- no usar el Render legacy;
- no copiar secretos a variables `NEXT_PUBLIC_*`;
- no habilitar cobros productivos antes de verificar webhook y dominio;
- no activar indexación mientras el dominio temporal siga siendo canónico.
