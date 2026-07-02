# TAREA CODEX — Migrar Materiales FZAC a Next.js + Supabase + Mercado Pago + Admin completo

Actuá como Tech Lead Senior + Arquitecto Full Stack + Desarrollador Next.js Senior + Especialista en Supabase + Especialista en pagos online + Diseñador UI/UX e-commerce.

Objetivo: crear una nueva versión profesional de **Materiales FZAC** en **Next.js**, tomando como base conceptual y funcional el proyecto actual:

https://github.com/DylanDev08/Materiales-FZAC

NO copiar ciegamente archivos viejos.
NO recrear errores del proyecto anterior.
NO usar Vite/React Router.
NO usar Express como backend separado si Next.js puede resolverlo con Route Handlers.
NO exponer secretos.
NO hardcodear credenciales.
NO subir `.env.local`.
NO usar colores fuera de la identidad FZAC.

---

# 1. Stack obligatorio

Crear el proyecto con:

```txt
Next.js App Router
React
TypeScript preferentemente
CSS Modules o CSS global modular
Supabase Database
Supabase Auth
Google OAuth por Supabase
Supabase Storage o Cloudinary para imágenes
Mercado Pago Developers
Adapter opcional para Naranja X API
Google Maps API
Server Actions o Route Handlers
Middleware de auth/admin
```

Usar Next.js moderno con carpeta:

```txt
app/
```

No usar Pages Router salvo que sea estrictamente necesario.

---

# 2. Identidad visual obligatoria

Mantener la identidad FZAC actual:

```txt
Negro principal: #0B0B0B
Negro secundario: #171717
Panel oscuro: #1F1F1F
Amarillo FZAC: #F4C400
Amarillo hover: #FFD31A
Blanco: #FFFFFF
Gris texto: #B8B8B8
Borde suave: rgba(255,255,255,.1)
Borde amarillo: rgba(244,196,0,.25)
Verde stock: #16834A
Rojo error: #C83232
```

Debe verse como:

```txt
E-commerce industrial premium
Tienda de materiales moderna
Corralón digital profesional
Sistema comercial real
```

No debe verse como:

```txt
Landing page
SaaS genérico
Portfolio institucional
Template blanco
Tienda rústica básica
Diseño de IA sin personalidad
```

---

# 3. Referencias visuales y funcionales

Tomar como referencia funcional de sección de pago:

```txt
https://tienda.layeserarosarina.com.ar/
```

Tomar como referencia de estética comercial/e-commerce:

```txt
https://www.tiendauniverso.com.ar/
```

No copiar diseño exacto, logos, textos ni assets.

Adaptar a FZAC con:

```txt
Header oscuro
Buscador protagonista
Categorías visibles
Cards de producto oscuras
Precios amarillos
Checkout claro y confiable
Panel admin operativo
```

---

# 4. Variables de entorno

Crear `.env.example`.

No crear `.env.local` con secretos reales.

Usar:

```env
NEXT_PUBLIC_SUPABASE_URL="https://gooxgjzetziwnxhuymmx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<SUPABASE_ANON_KEY>"

SUPABASE_SERVICE_ROLE_KEY="<SUPABASE_SERVICE_ROLE_KEY>"

NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"

MERCADOPAGO_ACCESS_TOKEN="<MERCADOPAGO_ACCESS_TOKEN>"
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY="<MERCADOPAGO_PUBLIC_KEY>"
MERCADOPAGO_WEBHOOK_SECRET="<MERCADOPAGO_WEBHOOK_SECRET>"

NARANJAX_API_BASE_URL="<NARANJAX_API_BASE_URL>"
NARANJAX_CLIENT_ID="<NARANJAX_CLIENT_ID>"
NARANJAX_CLIENT_SECRET="<NARANJAX_CLIENT_SECRET>"
NARANJAX_ENABLED="false"

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="<GOOGLE_MAPS_BROWSER_KEY>"
GOOGLE_MAPS_SERVER_API_KEY="<GOOGLE_MAPS_SERVER_KEY>"

ADMIN_EMAIL="dylansalcedo333@gmail.com"

FZAC_WHATSAPP="+5493415847000"
FZAC_EMAIL="fortalezaconstruccionesrosario@gmail.com"
FZAC_INSTAGRAM="@fzaconstrucciones"
```

Importante:

* No usar `https://gooxgjzetziwnxhuymmx.supabase.co/rest/v1/` como `NEXT_PUBLIC_SUPABASE_URL`.
* Esa URL `/rest/v1/` solo sirve como endpoint REST.
* Para Supabase client usar `https://gooxgjzetziwnxhuymmx.supabase.co`.
* Nunca exponer `SUPABASE_SERVICE_ROLE_KEY`.
* Nunca exponer tokens de Mercado Pago.
* Nunca exponer secretos de Naranja X.
* Nunca exponer claves server-side de Google Maps.

---

# 5. Supabase Auth + Google OAuth

Configurar Supabase Auth para:

```txt
Login con Google
Login con email
Registro de usuario
Logout
Persistencia de sesión
Protección de rutas
Rol de usuario
Rol admin
```

Callback Google informado:

```txt
https://gooxgjzetziwnxhuymmx.supabase.co/auth/v1/callback
```

También configurar en Supabase y Google Cloud:

```txt
http://localhost:3000/auth/callback
https://TU-DOMINIO.vercel.app/auth/callback
```

Crear en Next:

```txt
app/auth/callback/route.ts
```

Ese callback debe hacer `exchangeCodeForSession` y redirigir al usuario.

Crear middlewares/helpers:

```txt
lib/supabase/client.ts
lib/supabase/server.ts
lib/auth/get-user.ts
lib/auth/require-admin.ts
middleware.ts
```

Reglas:

```txt
Usuario normal entra a /cuenta
Admin entra a /admin
Admin autorizado por email y rol
No confiar solo en frontend
```

Admin principal:

```txt
dylansalcedo333@gmail.com
```

---

# 6. Base de datos Supabase

Crear SQL o migraciones Supabase para tablas:

```txt
profiles
categories
products
product_images
cart_items
orders
order_items
payments
purchase_tickets
purchase_ticket_items
inventory_movements
notifications
admin_audit_logs
chat_conversations
chat_messages
store_settings
addresses
favorites
reviews
search_events
product_views
```

## profiles

Debe vincularse con `auth.users`.

Campos mínimos:

```txt
id uuid primary key references auth.users(id)
email text unique
full_name text
phone text
avatar_url text
role text check role in ('USER','ADMIN','OPERATOR')
created_at
updated_at
last_login_at
```

## products

Campos:

```txt
id
slug unique
sku unique
name
description
category_id
subcategory
brand
price numeric(12,2)
compare_price numeric(12,2)
stock int
stock_minimum int
unit
image_url
gallery jsonb
specifications jsonb
featured boolean
on_sale boolean
active boolean
created_at
updated_at
```

## orders

Campos:

```txt
id
user_id
status
customer_name
customer_email
customer_phone
shipping_method
shipping_cost
subtotal
total
address_snapshot jsonb
notes
paid_at
created_at
updated_at
```

Estados:

```txt
PENDING_PAYMENT
PAID
CONFIRMED
PREPARING
READY_FOR_PICKUP
OUT_FOR_DELIVERY
DELIVERED
COMPLETED
CANCELLED
```

## payments

Campos:

```txt
id
order_id unique
provider
status
amount
currency
provider_preference_id
provider_payment_id
provider_session_id
raw jsonb
created_at
updated_at
```

Providers:

```txt
MERCADOPAGO
NARANJAX
MOCK
```

## tickets

Cada pago aprobado debe crear ticket.

Campos:

```txt
id
number unique
order_id unique
customer_name
customer_email
customer_phone
payment_provider
payment_id
subtotal
discount
shipping_cost
total
shipping_method
address_snapshot
notes
status
issued_at
created_at
```

## notifications

Debe permitir:

```txt
Notificaciones usuario
Notificaciones admin
No leídas
Leídas
Link de acción
```

Campos:

```txt
id
user_id nullable
target_role nullable
type
title
message
link_to
read boolean
read_at
created_at
```

---

# 7. Row Level Security

Activar RLS en Supabase.

Reglas:

```txt
Usuarios pueden leer/editar su propio profile.
Usuarios pueden leer sus pedidos.
Usuarios pueden leer sus tickets.
Usuarios pueden leer sus notificaciones.
Admin puede leer y modificar todo.
Productos activos son públicos.
Categorías activas son públicas.
CRUD admin solo para ADMIN.
```

No usar service role en cliente.

Usar service role solo en Route Handlers server-side.

---

# 8. Arquitectura de carpetas Next.js

Crear estructura:

```txt
materiales-fzac-next/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── not-found.tsx
│   │
│   ├── catalogo/
│   │   └── page.tsx
│   ├── productos/
│   │   └── page.tsx
│   ├── producto/
│   │   └── [slug]/
│   │       └── page.tsx
│   ├── categorias/
│   │   └── page.tsx
│   ├── categoria/
│   │   └── [slug]/
│   │       └── page.tsx
│   ├── ofertas/
│   │   └── page.tsx
│   ├── carrito/
│   │   └── page.tsx
│   ├── checkout/
│   │   └── page.tsx
│   ├── pago/
│   │   ├── aprobado/page.tsx
│   │   ├── pendiente/page.tsx
│   │   └── rechazado/page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── registro/
│   │   └── page.tsx
│   ├── auth/
│   │   └── callback/route.ts
│   ├── cuenta/
│   │   ├── page.tsx
│   │   ├── pedidos/page.tsx
│   │   ├── ajustes/page.tsx
│   │   ├── direcciones/page.tsx
│   │   └── conversaciones/page.tsx
│   ├── admin/
│   │   ├── page.tsx
│   │   ├── productos/page.tsx
│   │   ├── categorias/page.tsx
│   │   ├── pedidos/page.tsx
│   │   ├── pagos/page.tsx
│   │   ├── tickets/page.tsx
│   │   ├── clientes/page.tsx
│   │   ├── chats/page.tsx
│   │   ├── ajustes/page.tsx
│   │   └── apariencia/page.tsx
│   │
│   └── api/
│       ├── checkout/route.ts
│       ├── payments/
│       │   ├── mercadopago/route.ts
│       │   ├── mercadopago/webhook/route.ts
│       │   ├── naranjax/route.ts
│       │   └── simulate/route.ts
│       ├── admin/
│       │   ├── metrics/route.ts
│       │   ├── notifications/route.ts
│       │   └── products/route.ts
│       ├── maps/
│       │   └── distance/route.ts
│       └── assistant/route.ts
│
├── components/
│   ├── layout/
│   ├── home/
│   ├── catalog/
│   ├── product/
│   ├── cart/
│   ├── checkout/
│   ├── account/
│   ├── admin/
│   ├── chatbot/
│   └── ui/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── payments/
│   │   ├── mercadopago.ts
│   │   ├── naranjax.ts
│   │   └── payment-service.ts
│   ├── maps/
│   ├── db/
│   ├── validations/
│   ├── formatters/
│   └── utils/
│
├── types/
├── styles/
├── public/
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── .env.example
├── next.config.ts
├── package.json
└── README.md
```

---

# 9. Rutas públicas

Crear:

```txt
/
 /catalogo
 /productos
 /producto/[slug]
 /categorias
 /categoria/[slug]
 /ofertas
 /carrito
 /checkout
 /pago/aprobado
 /pago/pendiente
 /pago/rechazado
 /login
 /registro
 /cuenta
 /cuenta/pedidos
 /cuenta/ajustes
 /cuenta/conversaciones
 /admin
 /admin/productos
 /admin/categorias
 /admin/pedidos
 /admin/pagos
 /admin/tickets
 /admin/clientes
 /admin/chats
 /admin/ajustes
```

---

# 10. Home

La Home debe ser e-commerce, no landing.

Secciones:

```txt
Top bar
Header con logo, buscador, cuenta, carrito
Menú de categorías
Hero comercial
Categorías rápidas
Productos destacados
Ofertas
Más vendidos
Materiales de obra
Banner de pago online
Cómo comprar
Beneficios
Chatbot FZAC
Footer completo
```

---

# 11. Catálogo

Funciones:

```txt
Buscador
Filtros por categoría
Filtros por precio
Filtros por marca
Filtros por stock
Solo ofertas
Solo destacados
Ordenamiento
Paginación
Vista grid/lista
Skeleton loading
Estado vacío
```

---

# 12. Producto individual

Ruta:

```txt
/producto/[slug]
```

Mostrar:

```txt
Galería
Imagen principal
Nombre
SKU
Marca
Categoría
Precio
Precio anterior
Descuento
Stock
Selector cantidad
Agregar al carrito
Comprar ahora
Descripción
Ficha técnica
Usos recomendados
Productos relacionados
Productos complementarios
Medios de pago
Entrega/retiro
```

---

# 13. Carrito

Implementar carrito con:

```txt
Local storage para invitados
Sincronización con Supabase si está logueado
Editar cantidades
Eliminar productos
Validación de stock
Resumen
Subtotal
Envío
Total
CTA checkout
```

---

# 14. Checkout similar a tienda de referencia

Crear checkout profesional con pasos:

```txt
1. Datos del comprador
2. Entrega o retiro
3. Distancia / zona
4. Pago
5. Confirmación
```

Diseño:

```txt
Panel oscuro FZAC
Resumen lateral
Productos visibles
Total claro
Badges de seguridad
Métodos de pago
Mercado Pago
Naranja X opcional
Tarjeta crédito/débito
```

No guardar tarjeta en la base.

No procesar tarjetas directamente si no hay cumplimiento PCI.

Usar proveedor de pago.

---

# 15. Mercado Pago Developers

Implementar:

```txt
Crear preferencia/pago desde Route Handler server-side
Validar items desde DB, no desde frontend
Validar stock
Crear orden PENDING_PAYMENT
Crear payment PENDING
Redirigir a Mercado Pago
Webhook de Mercado Pago
Consultar pago real
Validar monto
Confirmar pedido
Descontar stock
Crear ticket
Crear notificación admin
```

Tarjeta de crédito/débito:

```txt
Debe estar soportada desde Mercado Pago Checkout/API.
No pedir ni guardar número de tarjeta en FZAC.
No guardar CVV.
No guardar datos sensibles.
```

---

# 16. Naranja X API

Crear integración opcional mediante adapter.

No asumir endpoints si no hay documentación oficial/credenciales.

Estructura:

```txt
lib/payments/naranjax.ts
app/api/payments/naranjax/route.ts
```

Debe estar desactivada por defecto:

```env
NARANJAX_ENABLED="false"
```

Si está desactivada, el checkout debe mostrar:

```txt
Naranja X estará disponible próximamente.
```

Si se cargan credenciales oficiales, implementar:

```txt
Crear intención de pago
Validar respuesta
Webhook si existe
Confirmar pago
Registrar raw payload
No descontar stock hasta pago aprobado
```

---

# 17. Google Maps API y distancia hasta 30 km de Rosario

Integrar Google Maps API server-side para calcular distancia.

Objetivo:

```txt
Aceptar dirección del cliente.
Calcular distancia desde Rosario/FZAC.
Permitir compra/envío si está dentro de 30 km.
Si supera 30 km, permitir solo retiro o mostrar aviso.
```

Crear:

```txt
lib/maps/distance.ts
app/api/maps/distance/route.ts
```

Usar server key en backend.

No exponer `GOOGLE_MAPS_SERVER_API_KEY`.

Configurar origen:

```txt
Rosario, Santa Fe, Argentina
```

Regla:

```txt
Si distancia <= 30 km → envío disponible.
Si distancia > 30 km → retiro o contacto con FZAC.
```

Guardar en order:

```txt
distance_km
delivery_available
delivery_zone_snapshot
```

---

# 18. Panel admin desde el comienzo

El admin debe estar completo desde el inicio.

Rutas:

```txt
/admin
/admin/productos
/admin/categorias
/admin/pedidos
/admin/pagos
/admin/tickets
/admin/clientes
/admin/chats
/admin/ajustes
/admin/apariencia
```

## Dashboard

Mostrar:

```txt
Ventas del día
Ventas del mes
Pedidos pendientes
Pagos aprobados
Pagos rechazados
Ticket promedio
Clientes nuevos
Productos activos
Productos con bajo stock
Últimos pedidos
Últimos tickets
Usuarios registrados/logueados
Conversaciones pendientes
```

## Vista de usuarios

Cada vez que un usuario se registre o loguee, el admin debe poder ver:

```txt
Gmail/email
Nombre
Teléfono
Fecha de registro
Último login
Compras realizadas
Total gastado
Cantidad de pedidos
Productos comprados
Cantidades
Precios
Dirección
Distancia a Rosario
Estado de entrega
Conversaciones
```

## CRUD obligatorio

Admin debe poder crear, editar, desactivar y eliminar lógicamente:

```txt
Productos
Categorías
Ofertas
Pedidos
Clientes
Tickets
Apariencia
Stock
```

Producto:

```txt
Nombre
Slug
SKU
Marca
Descripción
Precio
Precio anterior
Stock
Stock mínimo
Categoría
Subcategoría
Imagen
Galería
Especificaciones
Destacado
Oferta
Activo
```

Apariencia:

```txt
Color principal
Color secundario
Color de fondo
Color de cards
Color de botones
Logo
Hero title
Hero subtitle
Banners
Footer
Links sociales
```

No permitir CSS arbitrario ni JS desde admin.

---

# 19. Tickets automáticos

Cuando pago queda aprobado:

```txt
Crear PurchaseTicket
Crear PurchaseTicketItems
Descontar stock
Crear InventoryMovement
Crear Notification admin
```

Ticket debe incluir:

```txt
Número
Orden
Cliente
Email
Teléfono
Productos
SKU
Cantidad
Precio unitario
Subtotal
Total
Método pago
ID pago
Stock anterior
Stock resultante
Dirección/retiro
Distancia
Fecha
```

---

# 20. Notificaciones admin

Crear campanita admin:

```txt
Nuevo usuario registrado
Usuario logueado
Nueva compra aprobada
Pago pendiente
Pago rechazado
Ticket generado
Stock bajo
Mensaje nuevo
Pedido fuera de zona 30km
```

Funciones:

```txt
Leer
Marcar leída
Marcar todas leídas
Ir a pedido/ticket/cliente/chat
```

---

# 21. Chatbot FZAC

Crear chatbot con diseño FZAC:

```txt
Negro
Amarillo
Input oscuro
Texto visible
Botones rápidos
Historial
Derivación a admin
```

Debe responder:

```txt
Cómo comprar
Qué materiales necesito
Pagos
Envíos
Retiros
Estado de pedido
Cambios/devoluciones
Productos
Stock
Precios reales si consulta DB
Contacto humano
```

No debe:

```txt
Inventar precio
Inventar stock
Mostrar JSON
Mostrar errores técnicos
Exponer secretos
```

---

# 22. CSS

Usar CSS bien organizado:

```txt
app/globals.css
styles/tokens.css
styles/layout.css
styles/components.css
styles/admin.css
styles/checkout.css
styles/catalog.css
styles/product.css
styles/auth.css
```

No usar Tailwind si no está pedido.

Mantener CSS puro/profesional.

---

# 23. Seguridad

Implementar:

```txt
RLS Supabase
Server-side validation
Zod
Sanitización
Rate limit básico en Route Handlers sensibles
Middleware admin
No service role en cliente
No tokens de pago en frontend
No guardar tarjetas
No logs con secretos
No stack traces al usuario
```

---

# 24. Entrega esperada

El proyecto debe quedar funcional con:

```txt
Next.js corriendo
Supabase Auth funcionando
Google OAuth configurado
Catálogo funcionando
Producto individual funcionando
Carrito funcionando
Checkout funcionando
Mercado Pago preparado
Naranja X opcional por adapter
Google Maps distancia 30km
Admin CRUD funcionando
Admin usuarios/compras/distancia funcionando
Tickets funcionando
Notificaciones funcionando
Diseño FZAC completo
README claro
.env.example completo
```

---

# 25. Scripts

Agregar:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "db:types": "supabase gen types typescript --project-id gooxgjzetziwnxhuymmx > types/supabase.ts"
  }
}
```

---

# 26. README

Documentar:

```txt
Instalación
Variables
Supabase
Google OAuth
Mercado Pago
Naranja X opcional
Google Maps
Admin
Deploy Vercel
Migraciones SQL
Seed
Troubleshooting
```

---

# 27. Importante

Priorizar que compile.

Primero crear estructura base.

Después auth.

Después DB y productos.

Después carrito.

Después checkout/pagos.

Después admin.

Después chatbot.

Después diseño final.

No hacer todo en archivos gigantes. Modularizar.
