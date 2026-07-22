# Auditoria mobile UX/Auth - Materiales FZAC

Fecha: 2026-07-21  
Branch: `mobile-ux-auth-supabase-audit`  
Commit base: `e075db2`  
URL auditada: `https://materiales-fzac-8xmp.onrender.com/`  
Entorno local validado: `http://localhost:3101`

## Resumen ejecutivo

Se audito y corrigio la experiencia mobile del usuario final: navegacion, catalogo, producto, carrito, checkout, login/registro, enlaces legales y proteccion visual de rutas admin. El foco fue eliminar scroll horizontal, mejorar targets tactiles, evitar taps prematuros antes de hidratacion y asegurar que Google OAuth use redirect flow mobile.

Resultado: la suite Playwright completa finalizo con `146 passed` y `34 skipped` intencionales. TypeScript, lint y build pasaron.

## Viewports probados

- iPhone 13: perfil mobile Playwright.
- Pixel 7: perfil mobile Playwright.
- Galaxy S20 aproximado: `360x800`.
- Compacto chico: `360x740`.
- Control desktop Chromium para smoke general.

## Rutas probadas

- `/`
- `/productos`
- `/producto/[slug]` tomando un producto real del catalogo
- `/carrito`
- `/checkout`
- `/login`
- `/register`
- `/registro`
- `/terminos`
- `/privacidad`
- `/arrepentimiento`
- `/admin`

## Bugs mobile encontrados

| Area | Riesgo | Evidencia | Estado |
| --- | --- | --- | --- |
| Footer | Medio | El link largo de WhatsApp generaba `body.scrollWidth` mayor al viewport en 360px. | Corregido |
| Catalogo | Medio | El carril de rubros tenia margen negativo y generaba overflow intermitente. | Corregido |
| Auth | Medio | Link `Registrate` tenia area tactil de 21px. | Corregido |
| Menu mobile | Medio | Tap temprano podia ocurrir antes de hidratar `SiteNav`. | Corregido |
| Carrito/productos | Alto UX | Tap temprano en `Agregar` podia perderse si el provider de carrito todavia no hidrato. | Corregido |
| iOS/mobile inputs | Bajo | Inputs podian quedar por debajo de 16px y activar zoom. | Corregido |

## Bugs corregidos

- Se agrego `min-width: 0` y cortes seguros para textos/enlaces largos del footer.
- Se contuvo el carril horizontal de categorias dentro del viewport mobile.
- Se reforzaron botones, links e inputs a targets tactiles cercanos o superiores a 44px.
- Se agrego estado `ready` al menu mobile para evitar clicks antes de hidratacion.
- Se deshabilito `Agregar` y `Comprar ahora` hasta que el carrito este hidratado.
- Se preserva `next` seguro en Google OAuth para login/registro mobile.
- Se envolvieron paginas de login/registro en `Suspense` por `useSearchParams`.

## Estado del menu mobile

El menu abre, permite scroll, navega a productos y se cierra al navegar. Se valido en iPhone 13, Pixel 7, Galaxy S20 y 360x740. El boton queda temporalmente deshabilitado hasta que el componente cliente este listo.

## Estado de Home mobile

Carga sin scroll horizontal. CTA principales, WhatsApp, rubros y footer responden. Se mantuvo Home funcional y solo se conservaron ajustes heredados del boton de arrepentimiento visible.

## Estado de productos mobile

Catalogo carga sin overflow, rubros horizontales contenidos, acciones tactiles, productos escaneables y `Agregar` espera hidratacion del carrito para evitar perdida de estado.

## Estado de detalle producto mobile

La vista de producto conserva imagen, stock, cantidad, `Agregar al carrito`, `Comprar ahora` y WhatsApp. Los botones quedan bloqueados hasta que el carrito esta listo.

## Estado de carrito mobile

El carrito permite agregar producto, ver cantidades y avanzar al checkout. La prueba espera persistencia real en `localStorage` para evitar carreras falsas.

## Estado de checkout mobile

Checkout carga con productos, no genera overflow, permite completar datos basicos y no exige direccion cuando el flujo avanza por retiro. No se realizaron pagos reales.

## Estado de login/register mobile

Login y registro tienen inputs grandes, botones full-width/visibles y enlaces tactiles. Google OAuth queda preparado con redirect flow, no popup.

## Estado Google OAuth mobile

Codigo revisado:

- `signInWithOAuth` usa `redirectTo` con `window.location.origin`.
- `next` se valida para rutas internas y se envia al callback.
- `/auth/callback` intercambia `code` por session, evita open redirects y redirige segun usuario/admin.

Pendiente operativo:

- Verificar en Supabase Dashboard que el Site URL sea `https://materiales-fzac-8xmp.onrender.com`.
- Verificar redirect URLs permitidas:
  - `http://localhost:3000/**`
  - `http://localhost:3000/auth/callback`
  - `https://materiales-fzac-8xmp.onrender.com/**`
  - `https://materiales-fzac-8xmp.onrender.com/auth/callback`
- Verificar en Google Cloud el redirect autorizado de Supabase: `https://PROJECT_REF.supabase.co/auth/v1/callback`.

Nota: en este entorno no habia navegador conectado disponible para operar el panel visual de Supabase; el intento de browser control devolvio `No browser is available`. Se uso Supabase Management API en modo lectura/escritura acotada para Auth URL Configuration.

Actualizacion aplicada:

- `site_url`: `https://materiales-fzac-8xmp.onrender.com`
- `uri_allow_list`:
  - `http://localhost:3000/**`
  - `http://localhost:3000/auth/callback`
  - `https://materiales-fzac-8xmp.onrender.com/**`
  - `https://materiales-fzac-8xmp.onrender.com/auth/callback`
- Google Provider: habilitado.
- Google Client ID: presente.
- Google Secret: presente.
- Email/password: habilitado.
- Signup: habilitado.
- Password minimo: 8.

## Configuracion revisada en Supabase

Revision local segura sin imprimir secretos:

- `.env.example` declara `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- En `.env` local se detecto `NEXT_PUBLIC_SUPABASE_ANON_KEY` presente, `SUPABASE_SERVICE_ROLE_KEY` presente y `NEXT_PUBLIC_SUPABASE_URL` faltante.

Accion realizada:

- Se corrigio `.env` local removiendo BOM UTF-8 que rompia Supabase CLI.
- `NEXT_PUBLIC_SUPABASE_URL` ya figura presente en `.env` local.
- Verificar que `NEXT_PUBLIC_SUPABASE_URL` tambien este presente en Render si apareciera un error de cliente Supabase.

## RLS revisado

No se tocaron RLS, policies ni SQL. Se reviso el uso de auth en codigo:

- `requireAdmin` se ejecuta server-side para admin.
- Admin se valida por emails autorizados desde servidor, no por rol editable desde cliente.
- `SUPABASE_SERVICE_ROLE_KEY` queda en modulos server/admin, no en componentes client.

Pendiente:

- Auditoria directa de `pg_policies` desde Supabase Dashboard o SQL read-only. No se ejecuto por falta de navegador conectado y para no instalar tooling extra ni tocar DB.

## Rutas protegidas revisadas

- `/admin` anonimo redirige/bloquea y no expone datos en Playwright.
- `proxy.ts` mantiene redireccion desde `/admin` al path admin configurado.
- Las APIs admin existentes se mantienen bajo guards server-side.

## Legal/consumidor mobile

- `/arrepentimiento` existe y carga en mobile.
- Home/footer contienen acceso visible al boton de arrepentimiento.
- `/terminos` y `/privacidad` cargan sin overflow mobile.

Pendiente legal:

- Revision legal final por profesional para textos de consumidor, privacidad, cambios/devoluciones y reembolsos.

## Performance mobile

- Se redujo layout shift lateral eliminando overflow.
- Se conservaron `next/image` y `sizes` existentes.
- Se evito agregar librerias pesadas.

Pendiente:

- Lighthouse mobile sobre dominio final, una vez estabilizado Render/dominio propio.

## Accesibilidad mobile

- Se reforzaron focus/targets tactiles.
- Botones icon-only ya cuentan con labels principales en header/carrito.
- Google/login/register y menu tienen controles accesibles.

Pendiente:

- Auditoria axe dedicada para modales y flujos largos.

## Archivos modificados principales

- `app/globals.css`
- `app/login/page.tsx`
- `app/registro/page.tsx`
- `components/auth/auth-form.tsx`
- `components/layout/site-nav.tsx`
- `components/product/product-card.tsx`
- `components/product/product-buybox.tsx`
- `styles/auth.css`
- `styles/catalog.css`
- `styles/checkout.css`
- `styles/layout.css`
- `styles/product.css`
- `tests/e2e/mobile-ui.spec.ts`
- `playwright.config.ts`
- `docs/audits/mobile-ux-auth-audit.md`

Tambien se conservan cambios de auditoria general previos en legal/footer, Playwright smoke y headers.

## Variables requeridas

Sin valores:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `MERCADOPAGO_ACCESS_TOKEN`
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `PAYMENTS_ENABLED`
- `PAYMENTS_ENV`
- `ADMIN_EMAILS`

## Resultado typecheck

`npm run typecheck`: OK.

## Resultado lint

`npm run lint`: OK.

## Resultado build

`npm run build`: OK.

## Resultado Playwright

`npx playwright test`: OK.

Resultado final:

- `146 passed`
- `34 skipped` intencionales para casos desktop/API duplicados en proyectos mobile.

Suite mobile especifica:

- `mobile-compact-360`: 18/18 OK.
- Suite mobile previa completa: 72/72 OK.
- Verificacion puntual Pixel menu tras ultimo build: OK.

## Resultado npm audit

`npm audit --omit=dev`: falla por vulnerabilidad heredada de `sharp <0.35.0` via `next@16.2.10`.

No se ejecuto `npm audit fix --force` porque propone instalar `next@14.2.35`, lo que seria un downgrade mayor y puede romper el proyecto.

Pendiente:

- Actualizar a una version compatible de Next/sharp cuando exista parche seguro para la linea actual, o evaluar override controlado sin downgrade.

## Pendientes para produccion

1. Verificar `NEXT_PUBLIC_SUPABASE_URL` en Render si apareciera un error de cliente Supabase.
2. Probar Google OAuth real desde celular fisico contra Render.
3. Ejecutar auditoria read-only de RLS con acceso al panel/SQL.
4. Repetir Google OAuth real desde celular fisico o emulador con Render.
5. Repetir Mercado Pago test con comprador TESTUSER distinto del vendedor.
6. Resolver vulnerabilidad heredada `sharp/next` cuando haya upgrade seguro.
7. Ejecutar Lighthouse mobile sobre dominio final.
