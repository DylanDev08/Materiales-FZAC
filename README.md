# Materiales FZAC

E-commerce full stack para **Fortaleza Construcciones**, con storefront, cuenta de cliente, panel administrativo, asistente FZAC, checkout, pagos simulados para demo y PostgreSQL.

## Stack

### Frontend
- React + Vite
- React Router
- TanStack Query
- Context API para autenticacion y carrito
- CSS responsive con identidad FZAC negro + amarillo

### Backend
- Node.js + Express
- Prisma ORM
- PostgreSQL
- JWT con refresh token en cookie `httpOnly`
- Mercado Pago como proveedor principal cuando exista token real
- Modo de pago simulado cuando no hay `MERCADOPAGO_ACCESS_TOKEN`
- Cloudinary para imagenes administrativas
- OpenAI Responses API opcional para el asistente
- Helmet, CORS, validaciones, rate limits y auditoria

## Funcionalidades incluidas

- Home, catalogo, productos, ofertas y categorias.
- Buscador asistido con sugerencias.
- Vista previa de productos y detalle con galeria, precio, stock, SKU, ficha tecnica y relacionados.
- Carrito local para visitantes y sincronizado al iniciar sesion.
- Notificacion al agregar productos al carrito.
- Checkout protegido con retiro o envio.
- Pago real por Mercado Pago cuando se configure token.
- Simulacion de pago aprobado, pendiente o rechazado para demos sin proveedor real.
- Paginas de pago aprobado, pendiente y rechazado.
- Historial de pedidos y cuenta de cliente.
- Panel admin con dashboard, pedidos, tickets, pagos, productos, categorias, clientes, analytics y chats.
- CRUD administrativo de productos y categorias.
- Asistente FZAC perteneciente a Fortaleza Construcciones, con fallback local si OpenAI no esta configurado.

## Estructura

```text
materiales-fzac/
├── client/          # React + Vite
├── server/          # Express + Prisma
├── docs/
├── package.json
└── README.md
```

## Requisitos

- Node.js 20+
- npm 10+
- PostgreSQL 15+ o servicio compatible
- Opcional: Mercado Pago, Cloudinary, OpenAI y SMTP

## Instalacion

Desde la raiz:

```bash
npm run install:all
```

Crear archivos de entorno desde los ejemplos:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

En Windows PowerShell:

```powershell
Copy-Item client/.env.example client/.env
Copy-Item server/.env.example server/.env
```

## Variables de entorno

No se deben publicar valores reales en este README ni en el repositorio.

### Cliente

```env
VITE_API_URL=https://tu-backend.example.com/api
VITE_ENABLE_API_MOCKS=false
```

### Servidor

```env
NODE_ENV=production
PORT=4000
CLIENT_URL=https://tu-frontend.example.com
API_URL=https://tu-backend.example.com
DATABASE_URL=postgresql://usuario:password@host:puerto/db?schema=public
DIRECT_URL=postgresql://usuario:password@host:puerto/db?schema=public
JWT_ACCESS_SECRET=generar-un-secreto-largo
JWT_REFRESH_SECRET=generar-otro-secreto-largo
MERCADOPAGO_ACCESS_TOKEN=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
OPENAI_API_KEY=
ASSISTANT_ENABLED=true
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
SEED_CLIENT_EMAIL=
SEED_CLIENT_PASSWORD=
```

## Base de datos

```bash
npm run prisma:generate
npm run db:migrate
npm run db:seed
```

El seed crea datos de ejemplo. Las credenciales iniciales deben definirse mediante `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CLIENT_EMAIL` y `SEED_CLIENT_PASSWORD`. En produccion no se deben usar contrasenas de desarrollo.

## Ejecutar localmente

Levantar cliente y servidor juntos:

```bash
npm run dev
```

O por separado:

```bash
npm run dev:server
npm run dev:client
```

URLs habituales:
- Frontend: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Health check: `http://localhost:4000/api/health`
- DB health: `http://localhost:4000/api/health/db`
- Env health seguro: `http://localhost:4000/api/health/env`

`npm run dev:server` no ejecuta `prisma generate` en cada inicio para evitar bloqueos `EPERM` del query engine en Windows. Ejecutar `npm run prisma:generate` manualmente cuando cambie `server/src/prisma/schema.prisma`.

## Pagos

### Modo demo sin proveedor

Si `MERCADOPAGO_ACCESS_TOKEN` esta vacio, el checkout queda en modo simulacion. El usuario puede probar:
- Pago aprobado
- Pago pendiente
- Pago rechazado

Este modo sirve para demos, subhosting y pruebas del flujo completo sin usar tarjetas reales.

### Modo real con Mercado Pago

Cuando se configure `MERCADOPAGO_ACCESS_TOKEN`, el backend crea preferencias reales y usa:

```text
POST https://tu-backend.example.com/api/payments/mercadopago/webhook
```

El pedido se confirma solo cuando el pago aprobado llega al backend.

## Deploy en subhosting

1. Crear base PostgreSQL y cargar `DATABASE_URL`/`DIRECT_URL`.
2. Configurar variables privadas del servidor en el panel del hosting.
3. Configurar `VITE_API_URL` apuntando al backend publico.
4. Ejecutar migraciones antes de iniciar la API.
5. Dejar `MERCADOPAGO_ACCESS_TOKEN` vacio para demo o cargarlo cuando el jefe apruebe pagos reales.
6. Verificar CORS con `CLIENT_URL`.
7. Cambiar cualquier usuario inicial creado por seed.

### Vercel frontend

- Root Directory: `client`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

Variables:

```env
VITE_API_URL=https://URL-PUBLICA-DEL-BACKEND/api
VITE_ENABLE_API_MOCKS=false
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

No usar `localhost` en produccion. El cliente muestra un warning de build si `VITE_API_URL` apunta a localhost.

### Backend Railway/Render

Configurar las variables privadas del servidor y ejecutar:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run start
```

### Troubleshooting

- EPERM Prisma Windows: cerrar procesos Node abiertos y ejecutar `npm run prisma:generate` manualmente.
- Vercel detecta otro framework: usar `client` como Root Directory.
- API no responde en produccion: verificar que `VITE_API_URL` sea publica y termine en `/api`.
- PostgreSQL enum/migraciones: usar `prisma migrate deploy`; no usar `migrate reset` en produccion.

## Verificaciones

```bash
npm run build
npm run check:server
```

## Documentacion adicional

- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `server/database/schema.sql`
