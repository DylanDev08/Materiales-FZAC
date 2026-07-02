# Materiales FZAC Next

Nueva base profesional de e-commerce para Fortaleza Construcciones Rosario, migrada a Next.js App Router con Supabase, Mercado Pago, Google OAuth, distancia por Google Maps, carrito, checkout, tickets, notificaciones y panel admin.

## Stack

- Next.js App Router + React + TypeScript.
- Supabase Database, Auth, RLS y Storage compatible.
- Route Handlers server-side para checkout, pagos, webhooks, mapas y admin.
- Mercado Pago preparado para preferencias y webhook.
- Naranja X por adapter opcional, desactivado por defecto.
- CSS puro con identidad FZAC negro + amarillo.
- Buscador predictivo con sugerencias desde `/api/search/suggestions`.
- Asistente flotante AI BOT FZAC con historial local y persistencia opcional en Supabase.
- Boton flotante de WhatsApp.
- Rutas legales: terminos, privacidad, cambios/devoluciones, envios/retiros y medios de pago.

## Instalacion

```bash
npm install
npm run dev
```

La app corre en `http://localhost:3000`.

## Variables

El archivo `.env.example` incluye todas las claves requeridas. Tambien se dejo un `.env` local con placeholders, sin API keys reales ni contrasenas.

No subir `.env`, `.env.local` ni claves privadas. `.gitignore` ya los excluye.

Variables principales:

```env
NEXT_PUBLIC_SUPABASE_URL="https://gooxgjzetziwnxhuymmx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<SUPABASE_ANON_KEY>"
SUPABASE_SERVICE_ROLE_KEY="<SUPABASE_SERVICE_ROLE_KEY>"
MERCADOPAGO_ACCESS_TOKEN="<MERCADOPAGO_ACCESS_TOKEN>"
MERCADOPAGO_WEBHOOK_SECRET="<MERCADOPAGO_WEBHOOK_SECRET>"
GOOGLE_MAPS_SERVER_API_KEY="<GOOGLE_MAPS_SERVER_KEY>"
GOOGLE_CLIENT_ID="<GOOGLE_OAUTH_CLIENT_ID>"
GOOGLE_CLIENT_SECRET="<GOOGLE_OAUTH_CLIENT_SECRET>"
ADMIN_EMAILS="fortalezaconstruccionesrosario@gmail.com,dylansalcedo333@gmail.com"
```

Las contrasenas de administradores no se documentan ni se guardan en el repositorio. Deben cargarse en Supabase Auth o gestionarse por un canal seguro.

## Supabase

1. Crear o usar el proyecto Supabase.
2. Ejecutar `supabase/migrations/20260701000000_init_fzac.sql`.
3. Ejecutar `supabase/seed.sql` para categorias, productos iniciales y settings publicos.
4. Configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.

La migracion crea:

- `profiles`, `categories`, `products`, `product_images`, `cart_items`.
- `orders`, `order_items`, `payments`.
- `purchase_tickets`, `purchase_ticket_items`, `inventory_movements`.
- `notifications`, `admin_audit_logs`.
- `chat_conversations`, `chat_messages`.
- `store_settings`, `addresses`, `favorites`, `reviews`, `search_events`, `product_views`.

RLS queda activo. Usuarios leen sus propios datos y productos/categorias activos son publicos. Admin opera por backend con service role, nunca desde cliente.

## Auth y Google OAuth

Supabase Auth soporta email/password y Google OAuth.

Callback Supabase:

```txt
https://gooxgjzetziwnxhuymmx.supabase.co/auth/v1/callback
```

Callbacks de app:

```txt
http://localhost:3000/auth/callback
https://TU-DOMINIO.vercel.app/auth/callback
```

Los emails admin se autorizan con `ADMIN_EMAILS`. Al iniciar sesion, el backend sincroniza el perfil y reconoce rol admin por email autorizado o perfil `ADMIN`.

El panel `/admin` no se muestra en navegacion publica, redirige a login si no hay sesion admin y se marca `noindex`.

## Mercado Pago

El checkout crea orden y pago desde `app/api/checkout/route.ts`.

Flujo:

1. Valida items contra DB.
2. Valida stock.
3. Crea orden `PENDING_PAYMENT`.
4. Crea payment `PENDING`.
5. Si hay token, crea preferencia Mercado Pago.
6. El webhook consulta el pago real.
7. Si esta aprobado, confirma orden, descuenta stock, crea ticket, movimiento de inventario y notificacion admin.

Webhook:

```txt
https://TU-DOMINIO.vercel.app/api/payments/mercadopago/webhook
```

Sin token real, el checkout activa simulacion controlada para validar la experiencia sin tarjetas.

La ruta `/api/payments/cards` existe solo para documentar la politica de seguridad: FZAC no procesa tarjetas directamente ni recibe CVV.

## Naranja X

`NARANJAX_ENABLED="false"` por defecto.

La app muestra “Naranja X estara disponible proximamente”. No se asumieron endpoints sin documentacion oficial.

## Google Maps

`app/api/maps/distance/route.ts` usa `GOOGLE_MAPS_SERVER_API_KEY` server-side.

Regla:

- `<= 30 km`: envio disponible.
- `> 30 km`: retiro o contacto con FZAC.

La server key no se expone al cliente.

## Admin

Rutas:

- `/admin`
- `/admin/productos`
- `/admin/categorias`
- `/admin/pedidos`
- `/admin/pagos`
- `/admin/tickets`
- `/admin/clientes`
- `/admin/chats`
- `/admin/ajustes`
- `/admin/apariencia`

El panel usa `requireAdmin()` en servidor. Los endpoints admin vuelven `401` si no hay usuario admin.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run db:types
npm run db:push
npm run db:seed
```

## Deploy Vercel

1. Importar el repo.
2. Framework: Next.js.
3. Configurar variables de entorno reales en Vercel.
4. No usar `localhost` en produccion.
5. Configurar callbacks OAuth y webhook Mercado Pago con dominio final.
6. Ejecutar migraciones Supabase antes de abrir checkout real.

## Troubleshooting

- Auth no inicia: revisar `NEXT_PUBLIC_SUPABASE_URL`, anon key y callback `/auth/callback`.
- Admin redirige a cuenta: revisar `ADMIN_EMAILS` y que el usuario exista en Supabase Auth.
- Checkout queda en simulacion: falta `MERCADOPAGO_ACCESS_TOKEN`.
- Distancia falla: falta `GOOGLE_MAPS_SERVER_API_KEY` o direccion invalida.
- Productos no aparecen: ejecutar seed o cargar productos activos en Supabase.
