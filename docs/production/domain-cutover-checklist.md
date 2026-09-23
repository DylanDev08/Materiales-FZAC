# Cutover a dominio definitivo — Materiales FZAC

Dominio definitivo registrado: `fzacmateriales.store`.

## Arquitectura objetivo

```text
https://fzacmateriales.store      -> Vercel (proyecto canónico materiales-fzac-391o)
https://www.fzacmateriales.store  -> Vercel
/api/*                            -> rewrite same-origin hacia Render
Render backend                    -> https://materiales-fzac.onrender.com
Supabase / Mercado Pago / Maps / Resend / Meta detrás del backend
```

No se usa `api.fzacmateriales.store` durante este cutover: el frontend mantiene `/api/*` same-origin y Vercel lo deriva al Render canónico.

## DNS objetivo en DonWeb

### Sitio
- `A @ -> 76.76.21.21`
- `CNAME www -> cname.vercel-dns-0.com`
- Eliminar únicamente el `AAAA` del dominio raíz que apuntaba al hosting viejo.
- Conservar NS/SOA y registros de correo de DonWeb.

### Resend
- `TXT resend._domainkey` con la clave DKIM generada por Resend.
- `MX send -> feedback-smtp.sa-east-1.amazonses.com`, prioridad 10.
- `TXT send -> v=spf1 include:amazonses.com ~all`.
- `CNAME rsend -> send.forge.rmta.net`.
- El SPF raíz de DonWeb se conserva; el SPF de Resend vive en `send`.

## Estado del cutover

- [x] Dominio registrado en DonWeb.
- [x] DNS web apuntado a Vercel.
- [x] Registros DNS de Resend cargados.
- [x] Backend Render preautoriza el origen temporal, raíz y `www`.
- [x] MFA administrativo ya es requisito AAL2 a nivel aplicación/RLS.
- [ ] Asociar `fzacmateriales.store` y `www.fzacmateriales.store` al proyecto Vercel canónico.
- [ ] Esperar TLS válido en el dominio final.
- [ ] Completar verificación SPF/DKIM en Resend.
- [ ] Configurar remitente `no-reply@fzacmateriales.store`.
- [ ] Cambiar `FZAC_PUBLIC_SITE_URL` y `NEXT_PUBLIC_SITE_URL` al dominio final cuando responda por HTTPS.
- [ ] Supabase Auth: Site URL y redirect URLs del dominio final.
- [ ] Verificar TOTP de todos los admins.
- [ ] Configurar Turnstile para el hostname final.
- [ ] Mercado Pago: callbacks/webhook de producción al dominio final.
- [ ] Google: restricciones de browser key/OAuth al hostname final.
- [ ] Ejecutar `pnpm release:audit`.
- [ ] Smoke test completo.
- [ ] Activar `SEO_INDEXING_ENABLED=true` recién al final.

> Leaked Password Protection no se toma como bloqueante mientras el proyecto permanezca en el plan actual de Supabase y la opción no esté disponible.

## Orden de cambio restante

1. Asociar raíz + `www` al Vercel canónico.
2. Confirmar resolución DNS y TLS.
3. Terminar verificación Resend.
4. Cambiar URL pública canónica y remitente de email.
5. Ajustar Supabase Auth, Turnstile, Mercado Pago y Google al hostname real.
6. Ejecutar auditoría de release.
7. Smoke test:
   - home;
   - catálogo;
   - login;
   - registro;
   - recuperación;
   - MFA admin;
   - carrito;
   - reserva de stock;
   - checkout;
   - webhook;
   - orden/ticket;
   - admin;
   - upload imagen;
   - mobile.
8. Activar indexación SEO.

## No hacer

- no apuntar DNS a proyectos Vercel duplicados;
- no usar Render legacy;
- no copiar secretos a variables `NEXT_PUBLIC_*`;
- no habilitar cobros productivos antes de verificar webhook, credenciales productivas y dominio;
- no activar indexación mientras el dominio temporal siga siendo canónico;
- no borrar MX/SPF/DKIM existentes de DonWeb que correspondan a su servicio de correo.
