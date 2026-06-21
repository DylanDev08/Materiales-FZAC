# Deploy

## 1. Supabase

1. Crear un proyecto.
2. Copiar las URLs de conexión Postgres.
3. Configurar `DATABASE_URL` y `DIRECT_URL`.
4. Ejecutar migraciones y seed desde el backend.
5. Habilitar Google en Authentication > Providers si se usará OAuth.
6. Registrar las URLs de callback local y productiva.

## 2. Railway

Root Directory: `server`

Variables mínimas:
- `NODE_ENV=production`
- `PORT=4000`
- `CLIENT_URL`
- `API_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Agregar además Supabase Auth, OpenAI, Cloudinary y SMTP cuando correspondan.

Health check: `/api/health`

## 3. Stripe

1. Crear el endpoint del webhook hacia `/api/checkout/webhook`.
2. Suscribir `checkout.session.completed` y `checkout.session.expired`.
3. Guardar el signing secret como `STRIPE_WEBHOOK_SECRET`.
4. Probar primero en modo test.

## 4. Vercel

Root Directory: `client`

Variables:
- `VITE_API_URL=https://backend.example.com/api`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENABLE_API_MOCKS=false`

El archivo `vercel.json` reescribe las rutas hacia `index.html`.

## 5. Checklist antes de producción

- Cambiar credenciales del seed.
- Usar secretos aleatorios largos.
- Desactivar mocks del frontend.
- Verificar CORS.
- Configurar dominio y HTTPS.
- Probar webhook real de Stripe.
- Probar emails.
- Probar login local y Google.
- Cargar imágenes definitivas en Cloudinary.
- Revisar términos, privacidad y devoluciones con asesoría legal local.
- Configurar backups de PostgreSQL.
- Usar un store distribuido para rate limit si hay más de una instancia.
