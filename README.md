# Materiales FZAC

E-commerce full stack para **Fortaleza Construcciones**, preparado como monorepo con storefront, cuenta de cliente, panel administrativo, asistente FZAC, pagos online y PostgreSQL.

## Stack

### Frontend
- React 18 + Vite
- React Router
- TanStack Query
- Supabase Auth para Google OAuth
- Context API para autenticación y carrito
- CSS responsive con identidad FZAC

### Backend
- Node.js + Express
- Prisma ORM
- PostgreSQL / Supabase
- JWT + refresh token en cookie `httpOnly`
- Stripe Checkout + webhook
- Cloudinary para imágenes administrativas
- OpenAI Responses API para el asistente, con fallback local sin clave
- Nodemailer para avisos de pedido
- Helmet, CORS, sanitización, validaciones y rate limiting

## Funcionalidades incluidas

### Tienda
- Home e-commerce
- Catálogo, productos, ofertas y categorías
- Buscador asistido con sugerencias
- Página de detalle con galería, precio, stock, cantidad, ficha técnica, favoritos y recomendaciones
- Carrito local para visitantes y sincronizado con PostgreSQL al iniciar sesión
- Checkout protegido
- Retiro o envío
- Pago con Stripe
- Páginas de pago aprobado y rechazado
- Historial y seguimiento de pedidos
- Fotografías reales remotas para el catálogo de ejemplo

### Cuenta del cliente
- Registro e inicio de sesión
- Google OAuth mediante Supabase
- Resumen de compras confirmadas y pendientes
- Carrito del servidor
- Favoritos
- Preferencias y ajustes
- Cambio de contraseña
- Historial de conversaciones
- Chat con IA y derivación a un administrador

### Administrador
- Dashboard con ventas, pedidos, clientes, stock y métricas
- Gestión de estados de pedidos
- CRUD de productos
- CRUD de categorías
- Carga de imágenes con Cloudinary
- Clientes
- Analítica de productos y búsquedas
- Alertas de stock
- Chat de soporte con respuestas del administrador
- Auditoría y notificaciones

### Asistente FZAC
- Búsqueda semántica sobre el catálogo
- Recomendaciones de productos
- Consulta de disponibilidad
- Respuestas contextualizadas con OpenAI cuando hay clave configurada
- Fallback determinista y funcional cuando OpenAI no está configurado
- Conversaciones persistidas para usuarios y visitantes
- Derivación a atención humana

## Estructura

```text
materiales-fzac/
├── client/                 # React + Vite
├── server/                 # Express + Prisma
│   ├── database/schema.sql # SQL consolidado para una base nueva
│   └── src/prisma/         # Schema, migraciones y seed
├── docs/
├── package.json
└── README.md
```

## Requisitos

- Node.js 20+
- npm 10+
- PostgreSQL 15+ o un proyecto de Supabase
- Cuenta de Stripe para pagos reales
- Opcional: Cloudinary, OpenAI y SMTP

## Instalación

Desde la raíz:

```bash
npm run install:all
```

Creá los archivos de entorno:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

En Windows PowerShell:

```powershell
Copy-Item client/.env.example client/.env
Copy-Item server/.env.example server/.env
```

## Base de datos

Completá en `server/.env`:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

Con Supabase se recomienda:
- `DATABASE_URL`: URL con pooler para la aplicación.
- `DIRECT_URL`: conexión directa para migraciones.

Después ejecutá:

```bash
npm run prisma:generate
npm run db:migrate
npm run db:seed
```

También se incluye `server/database/schema.sql` como SQL consolidado para una base PostgreSQL nueva. Para mantener historial y futuras actualizaciones, la opción recomendada sigue siendo Prisma Migrate.

## Ejecutar localmente

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev:client
```

URLs:
- Frontend: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Health check: `http://localhost:4000/api/health`

## Usuarios del seed

### Administrador
```text
Email: admin@materialesfzac.com
Contraseña: AdminFzac2026!
```

### Cliente
```text
Email: cliente@materialesfzac.com
Contraseña: ClienteFzac2026!
```

Cambiar estas credenciales antes de publicar una instalación real.

## Stripe

Variables del backend:

```env
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=ars
```

Webhook recomendado:

```text
POST https://TU-BACKEND/api/checkout/webhook
```

Eventos usados:
- `checkout.session.completed`
- `checkout.session.expired`

Sin `STRIPE_SECRET_KEY` y con `NODE_ENV=development`, el proyecto usa un modo de pago simulado para probar el flujo. En producción, la clave es obligatoria.

Para probar webhooks localmente con Stripe CLI:

```bash
stripe listen --forward-to localhost:4000/api/checkout/webhook
```

## Google OAuth con Supabase

Cliente:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Servidor:

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Configurar en Supabase:
- Proveedor Google habilitado.
- URL local de redirección: `http://localhost:5173/auth/callback`.
- URL productiva de redirección: `https://TU-FRONTEND/auth/callback`.

## Asistente FZAC

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
ASSISTANT_ENABLED=true
```

La clave existe únicamente en el backend. Nunca agregarla al frontend ni a variables `VITE_*`.

## Cloudinary

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Se usa en el panel para subir imágenes de productos.

## Email

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="Materiales FZAC <ventas@materialesfzac.com>"
```

## Validaciones y seguridad

Incluye:
- JWT de acceso y refresh token rotado.
- Cookie de refresh `httpOnly`.
- Roles `USER`, `OPERATOR` y `ADMIN`.
- Rutas protegidas.
- Rate limits globales, de autenticación, registro, checkout, admin y asistente.
- Helmet y headers de seguridad.
- CORS restringido al frontend configurado.
- Validación de entradas.
- Honeypot y protección básica antibots en auth.
- Descuento de stock transaccional después de pago aprobado.
- Registro de auditoría.

Para varias instancias del backend, reemplazar el almacenamiento en memoria del rate limiter por Redis u otro store compartido.

## Verificación

```bash
npm run build
npm run check:server
```

Prisma:

```bash
npm run prisma:generate
npm run db:migrate
```

## Deploy

### Frontend — Vercel

Importar `client/` como Root Directory y configurar:

```env
VITE_API_URL=https://TU-BACKEND/api
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ENABLE_API_MOCKS=false
```

`client/vercel.json` contiene el rewrite para React Router.

### Backend — Railway

Importar `server/` como Root Directory. Se incluye `server/railway.json` y `server/Dockerfile`.

Configurar todas las variables de `server/.env.example`. El comando de despliegue ejecuta las migraciones antes de iniciar la API.

## Documentación adicional

- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `server/database/schema.sql`
