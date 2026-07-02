# Materiales FZAC Next

E-commerce profesional para Fortaleza Construcciones Rosario, construido con Next.js App Router, Supabase, Mercado Pago, carrito, checkout, tickets, notificaciones, chatbot FZAC y panel admin.

## Stack

- Next.js App Router + React + TypeScript.
- Supabase Database, Auth, RLS y Storage compatible.
- Route Handlers server-side para auth, checkout, pagos, webhooks, buscador, chatbot y admin.
- Mercado Pago preparado para preferencias y webhook.
- Naranja X por adapter opcional, desactivado por defecto.
- CSS puro con identidad FZAC negro + amarillo.
- Buscador predictivo con productos, categorias, marcas, terminos e historial local.
- Chatbot FZAC con historial local y persistencia opcional en Supabase.
- WhatsApp visible para contacto comercial.
- Rutas legales: terminos, privacidad, cambios/devoluciones, envios/retiros y medios de pago.

## Instalacion

```bash
npm install
npm run dev
```

La app corre en `http://localhost:3000`.

## Variables

Usar `.env.example` como plantilla y cargar valores reales solo en `.env` local o variables del hosting. No subir `.env`, `.env.local`, service role, tokens de Mercado Pago ni credenciales privadas.

Variables principales:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_API_URL=
MERCADOPAGO_ACCESS_TOKEN=
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=
ADMIN_EMAILS=
NEXT_PUBLIC_FZAC_WHATSAPP=
NEXT_PUBLIC_FZAC_EMAIL=
```

Las contrasenas de administradores no se documentan ni se guardan en el repositorio. Deben cargarse en Supabase Auth o gestionarse por un canal seguro.

## Supabase

1. Crear o usar el proyecto Supabase.
2. Ejecutar `supabase/migrations/20260701000000_init_fzac.sql`.
3. Ejecutar `supabase/seed.sql` para categorias, productos iniciales y settings publicos.
4. Configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.

RLS queda activo. Usuarios leen sus propios datos y productos/categorias activos son publicos. Admin opera por backend con service role, nunca desde cliente.

## Auth

Supabase Auth soporta email/password y Google OAuth desde el dashboard de Supabase.

Callbacks de app:

```txt
http://localhost:3000/auth/callback
https://TU-DOMINIO.vercel.app/auth/callback
```

Los emails admin se autorizan con `ADMIN_EMAILS` o `ADMIN_EMAIL`. Al iniciar sesion, el backend sincroniza el perfil y redirige admins a `/admin`.

## Checkout Y Pagos

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

FZAC no procesa tarjetas directamente ni recibe CVV. La ruta `/api/payments/cards` documenta esa politica.

## Envios Y Retiros

No se integran APIs de mapas. El checkout toma direccion, telefono y notas como datos operativos; FZAC coordina retiro o envio administrativamente.

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

## Troubleshooting

- Auth no inicia: revisar `NEXT_PUBLIC_SUPABASE_URL`, anon key y callback `/auth/callback`.
- Admin redirige a cuenta: revisar `ADMIN_EMAILS` y que el usuario exista en Supabase Auth.
- Checkout queda en simulacion: falta `MERCADOPAGO_ACCESS_TOKEN`.
- Productos no aparecen: ejecutar seed o cargar productos activos en Supabase.
