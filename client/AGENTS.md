# AGENTS.md — Materiales FZAC

## Rol del agente

Actuá como un Tech Lead Senior + Arquitecto Full Stack + Desarrollador React/Node Senior + Diseñador UI/UX especializado en e-commerce reales.

Este proyecto es un e-commerce completo llamado:

# Materiales FZAC

Materiales FZAC pertenece a Fortaleza Construcciones, empresa de construcción ubicada en Rosario, Argentina.

El objetivo es construir un sistema real de compra y venta de materiales, herramientas e insumos de construcción.

No crear demos.
No crear placeholders vacíos.
No generar código suelto.
No hacer una landing institucional.
No hacer una plantilla genérica.
No exponer credenciales.
No subir `.env` reales.

---

## Contexto del negocio

Materiales FZAC debe funcionar como un e-commerce real para productos de construcción.

Debe sentirse como:

* E-commerce industrial premium.
* Corralón moderno.
* Tienda profesional.
* Sistema serio de compra y venta.
* Plataforma limpia, llamativa, comercial y funcional.

Debe tomar como guía visual:

* Identidad FZAC: negro + amarillo.
* Estética profesional del portfolio de Fortaleza Construcciones.
* Estructura comercial de una tienda de materiales.
* Catálogo claro, productos protagonistas y compra rápida.

No debe parecer:

* SaaS genérico.
* Diseño de IA.
* Landing page.
* Portfolio institucional.
* Tienda rústica sin estilo.
* Template básico de React.

---

## Stack obligatorio

### Frontend

* React.
* Vite.
* React Router DOM.
* TanStack React Query.
* Axios.
* React Hook Form.
* Zod.
* Zustand o Context API según convenga.
* React Icons.
* Framer Motion solo para animaciones sutiles.
* CSS modular organizado.
* Supabase JS Client para Google OAuth.
* Responsive real.

### Backend

* Node.js.
* Express.js.
* Prisma ORM.
* PostgreSQL en Supabase.
* JWT Access Token.
* JWT Refresh Token.
* bcrypt.
* Cookie Parser.
* Helmet.
* CORS estricto.
* Express Rate Limit.
* Zod para validaciones.
* Multer.
* Cloudinary para imágenes.
* Mercado Pago SDK.
* Nodemailer.
* OpenAI API para chatbot.
* Logging y auditoría.

### Base de datos

* Supabase PostgreSQL.
* Prisma ORM.
* Base de datos relacional.
* No usar Firebase Database.

### Pagos

* Mercado Pago.
* Checkout web.
* Webhooks.
* Validación de monto desde backend.
* Confirmación de pedido solo si el pago fue aprobado.

---

## Arquitectura general

El proyecto debe ser un monorepo:

```txt
materiales-fzac/
├── client/
├── server/
├── shared/
├── docs/
├── package.json
├── .gitignore
└── AGENTS.md
```

---

## Arquitectura del frontend

```txt
client/
├── public/
├── src/
│   ├── api/
│   │   ├── apiClient.js
│   │   ├── authApi.js
│   │   ├── productsApi.js
│   │   ├── categoriesApi.js
│   │   ├── cartApi.js
│   │   ├── checkoutApi.js
│   │   ├── ordersApi.js
│   │   ├── accountApi.js
│   │   ├── assistantApi.js
│   │   └── adminApi.js
│   │
│   ├── assets/
│   │   ├── logo/
│   │   ├── images/
│   │   ├── products/
│   │   └── icons/
│   │
│   ├── components/
│   │   ├── common/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── navigation/
│   │   ├── home/
│   │   ├── catalog/
│   │   ├── product/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── account/
│   │   ├── chatbot/
│   │   ├── admin/
│   │   ├── forms/
│   │   └── feedback/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── orders/
│   │   ├── favorites/
│   │   ├── recommendations/
│   │   ├── chatbot/
│   │   ├── support/
│   │   └── admin/
│   │
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   │   ├── Home/
│   │   ├── Catalog/
│   │   ├── Category/
│   │   ├── ProductDetail/
│   │   ├── Offers/
│   │   ├── BestSellers/
│   │   ├── Cart/
│   │   ├── Checkout/
│   │   ├── PaymentSuccess/
│   │   ├── PaymentFailure/
│   │   ├── Login/
│   │   ├── Register/
│   │   ├── AuthCallback/
│   │   ├── Account/
│   │   ├── Orders/
│   │   ├── OrderDetail/
│   │   ├── Favorites/
│   │   ├── Settings/
│   │   ├── Support/
│   │   ├── About/
│   │   ├── Contact/
│   │   ├── Legal/
│   │   └── Admin/
│   │
│   ├── routes/
│   │   ├── AppRouter.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── GuestRoute.jsx
│   │   └── AdminRoute.jsx
│   │
│   ├── store/
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── reset.css
│   │   ├── global.css
│   │   ├── typography.css
│   │   ├── utilities.css
│   │   └── responsive.css
│   │
│   ├── validations/
│   ├── constants/
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
│
├── .env.example
├── vite.config.js
└── package.json
```

---

## Arquitectura del backend

Usar arquitectura modular por dominio, no controladores gigantes.

```txt
server/
├── src/
│   ├── config/
│   │   ├── env.js
│   │   ├── database.js
│   │   ├── supabase.js
│   │   ├── mercadoPago.js
│   │   ├── cloudinary.js
│   │   ├── openai.js
│   │   └── mail.js
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   ├── auth.repository.js
│   │   │   ├── auth.routes.js
│   │   │   └── auth.schemas.js
│   │   │
│   │   ├── users/
│   │   ├── addresses/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── inventory/
│   │   ├── cart/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── tickets/
│   │   ├── favorites/
│   │   ├── reviews/
│   │   ├── offers/
│   │   ├── recommendations/
│   │   ├── assistant/
│   │   ├── conversations/
│   │   ├── notifications/
│   │   ├── analytics/
│   │   ├── appearance/
│   │   └── admin/
│   │
│   ├── middleware/
│   │   ├── authentication.js
│   │   ├── authorization.js
│   │   ├── validateRequest.js
│   │   ├── errorHandler.js
│   │   ├── notFound.js
│   │   ├── rateLimits.js
│   │   ├── requestLogger.js
│   │   └── upload.js
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   │
│   ├── shared/
│   │   ├── errors/
│   │   ├── utils/
│   │   ├── constants/
│   │   └── validators/
│   │
│   ├── app.js
│   └── server.js
│
├── database/
│   └── schema.sql
├── tests/
├── .env.example
└── package.json
```

---

## Variables de entorno del backend

Crear `server/.env.example`.

Nunca subir `server/.env` real.

Usar placeholders. El usuario configurará los valores reales localmente.

```env
# Supabase PostgreSQL mediante connection pooling
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<SUPABASE_DB_PASSWORD>@<SUPABASE_POOLER_HOST>:5432/postgres?pgbouncer=true"

# Conexión directa usada para migraciones Prisma
DIRECT_URL="postgresql://postgres.<PROJECT_REF>:<SUPABASE_DB_PASSWORD>@<SUPABASE_DIRECT_HOST>:5432/postgres"

NODE_ENV="development"
PORT="4000"

JWT_ACCESS_SECRET="<JWT_ACCESS_SECRET_SEGURO>"
JWT_REFRESH_SECRET="<JWT_REFRESH_SECRET_SEGURO>"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

API_URL="http://localhost:4000"
CLIENT_URL="http://localhost:5173"

SUPABASE_URL="<SUPABASE_URL>"
SUPABASE_SERVICE_ROLE_KEY="<SUPABASE_SERVICE_ROLE_KEY>"

MERCADOPAGO_ACCESS_TOKEN="<MERCADOPAGO_ACCESS_TOKEN>"
MERCADOPAGO_PUBLIC_KEY="<MERCADOPAGO_PUBLIC_KEY>"
MERCADOPAGO_WEBHOOK_SECRET="<MERCADOPAGO_WEBHOOK_SECRET>"

CLOUDINARY_CLOUD_NAME="<CLOUDINARY_CLOUD_NAME>"
CLOUDINARY_API_KEY="<CLOUDINARY_API_KEY>"
CLOUDINARY_API_SECRET="<CLOUDINARY_API_SECRET>"

OPENAI_API_KEY="<OPENAI_API_KEY>"
OPENAI_MODEL="gpt-4.1-mini"

SMTP_HOST="<SMTP_HOST>"
SMTP_PORT="587"
SMTP_USER="<SMTP_USER>"
SMTP_PASSWORD="<SMTP_PASSWORD>"
SMTP_FROM="Materiales FZAC <no-reply@materialesfzac.com>"

ADMIN_EMAIL="fortalezaconstruccionesrosario@gmail.com"
ADMIN_INITIAL_PASSWORD="<ADMIN_INITIAL_PASSWORD_CAMBIAR_EN_PRIMER_LOGIN>"
```

Reglas:

* No hardcodear secretos.
* No imprimir variables de entorno.
* No devolver secretos por API.
* No usar credenciales reales en `.env.example`.
* No subir `.env` al repositorio.

---

## Variables de entorno del frontend

Crear `client/.env.example`.

```env
VITE_API_URL="http://localhost:4000/api"

VITE_SUPABASE_URL="<SUPABASE_URL>"
VITE_SUPABASE_ANON_KEY="<SUPABASE_ANON_KEY>"
VITE_SUPABASE_PUBLISHABLE_KEY="<SUPABASE_PUBLISHABLE_KEY>"

VITE_MERCADOPAGO_PUBLIC_KEY="<MERCADOPAGO_PUBLIC_KEY>"

VITE_ENABLE_API_MOCKS="true"
```

Cuando el backend esté funcionando:

```env
VITE_ENABLE_API_MOCKS="false"
```

Google OAuth mediante Supabase:

1. Configurar Google Provider en Supabase Auth.
2. Agregar Redirect URL:
   `http://localhost:5173/auth/callback`
3. Agregar el callback de Supabase en Google Cloud OAuth.
4. En producción agregar la URL real.
5. Luego del callback, sincronizar el usuario con el backend.

---

## Autenticación

### Usuarios comunes

Implementar:

* Registro con nombre, apellido, email, teléfono y contraseña.
* Login con email y contraseña.
* Login con Google mediante Supabase.
* Logout.
* Refresh token.
* Sesiones persistentes.
* Recuperación de contraseña.
* Validaciones con Zod.
* Contraseñas hasheadas con bcrypt.
* Tokens seguros.

### Administrador

El panel admin debe protegerse desde backend y frontend.

Reglas:

* Solo puede acceder el email autorizado:
  `fortalezaconstruccionesrosario@gmail.com`
* La contraseña inicial debe venir desde variable de entorno.
* La contraseña debe guardarse hasheada.
* No hardcodear contraseña en React.
* No hardcodear contraseña en Express.
* No exponer contraseña en seed público.
* Forzar cambio de contraseña en primer login.
* Validar rol `ADMIN`.
* Validar usuario activo.
* Validar sesión.
* Validar refresh token.
* La autorización final debe realizarse en el backend.

---

## Paleta visual

Marca visible:

# Materiales FZAC

No usar `materialesfzac` como marca principal.

Colores:

```txt
Negro principal: #0B0B0B
Negro secundario: #171717
Amarillo FZAC: #F4C400
Amarillo hover: #FFD31A
Blanco: #FFFFFF
Fondo claro: #F6F2EA
Gris texto: #6B6B66
Gris borde: #DED9CE
Verde stock: #16834A
Rojo error: #C83232
```

Tipografía:

* Archivo para títulos.
* Manrope para textos, inputs y controles.

Dirección visual:

* Industrial premium.
* E-commerce real.
* Llamativo.
* Moderno.
* Limpio.
* Comercial.
* Ordenado.
* Fuerte identidad FZAC.
* Mucho foco en productos.
* Buen contraste.
* Cards profesionales.
* Botones visibles.
* Header sólido.
* Chatbot negro con amarillo FZAC.

No usar:

* Emojis.
* Glassmorphism.
* SaaS genérico.
* Cards demasiado redondeadas.
* Gradientes exagerados.
* Colores random.
* Hero tipo portfolio.
* Secciones institucionales largas.

---

## Arquitectura pública de la web

```txt
/
├── /catalogo
├── /categoria/:slug
├── /producto/:slug
├── /ofertas
├── /mas-vendidos
├── /nuevos
├── /carrito
├── /checkout
├── /pago/exitoso
├── /pago/pendiente
├── /pago/fallido
├── /login
├── /registro
├── /auth/callback
├── /nosotros
├── /contacto
├── /como-comprar
├── /envios-y-retiros
├── /medios-de-pago
├── /preguntas-frecuentes
├── /terminos-y-condiciones
├── /privacidad
└── /cambios-y-devoluciones
```

---

## Home

La Home debe ser una tienda, no una landing.

Orden recomendado:

1. Top bar.
2. Header con logo, buscador, cuenta, pedidos y carrito.
3. Navegación por categorías.
4. Banner comercial principal.
5. Categorías rápidas.
6. Ofertas destacadas.
7. Productos más vendidos.
8. Productos por rubro.
9. Banner de pago online.
10. Recomendaciones personalizadas.
11. Cómo comprar.
12. Beneficios.
13. Footer.

Cada sección debe dirigir al catálogo o a productos concretos.

---

## Catálogo

Incluir:

* Buscador.
* Buscador asistido por IA.
* Categorías.
* Subcategorías.
* Marcas.
* Precio mínimo.
* Precio máximo.
* Stock.
* Solo ofertas.
* Solo destacados.
* Productos nuevos.
* Ordenamiento.
* Vista grid.
* Vista lista.
* Paginación.
* Skeleton loading.
* Estado vacío.
* Manejo de errores.

El buscador asistido debe interpretar consultas naturales como:

```txt
Necesito materiales para hacer una pared de drywall.
Busco pintura para interior.
Necesito cable para una instalación domiciliaria.
Quiero herramientas para colocar placas.
```

La IA debe convertir la consulta en filtros y recomendaciones sin mostrar JSON.

---

## Detalle de producto

Al seleccionar un producto debe navegar a:

```txt
/producto/:slug
```

Mostrar:

* Breadcrumb.
* Galería real.
* Foto principal.
* Zoom.
* Marca.
* SKU.
* Nombre.
* Precio.
* Precio anterior.
* Descuento.
* Stock.
* Selector de cantidad.
* Agregar al carrito.
* Comprar ahora.
* Favoritos.
* Descripción.
* Ficha técnica.
* Usos recomendados.
* Métodos de pago.
* Entrega o retiro.
* Productos relacionados.
* Productos complementarios.
* Opiniones.
* Recomendaciones de IA.

Ejemplo complementarios para placa de yeso:

* Perfil montante.
* Perfil solera.
* Tornillos.
* Cinta.
* Masilla.

---

## Carrito

Implementar:

* Carrito persistente para invitados.
* Carrito vinculado al usuario al iniciar sesión.
* Sincronización con backend.
* Cantidad editable.
* Eliminación.
* Resumen.
* Subtotal.
* Envío.
* Descuento.
* Total.
* Cupón.
* Productos sugeridos.
* Continuar comprando.
* Iniciar checkout.
* Validación de stock antes de pagar.

---

## Checkout y Mercado Pago

Todo debe realizarse dentro de la web.

No usar WhatsApp como mecanismo de confirmación.

Pasos:

1. Identificación.
2. Datos personales.
3. Dirección.
4. Retiro o envío.
5. Facturación.
6. Revisión.
7. Mercado Pago.
8. Confirmación.

Backend obligatorio:

* Recalcular precios desde base de datos.
* Validar stock.
* Crear orden pendiente.
* Crear preferencia de Mercado Pago.
* Registrar intento de pago.
* Recibir webhook.
* Consultar el pago directamente con Mercado Pago.
* Verificar monto.
* Marcar pago como aprobado.
* Descontar stock dentro de una transacción.
* Confirmar orden.
* Generar ticket.
* Notificar cliente.
* Notificar administrador.

Nunca confiar en parámetros del frontend para declarar un pago aprobado.

---

## Tickets automáticos

Cada compra aprobada debe crear un ticket interno.

Debe contener:

* Número único.
* ID de orden.
* Cliente.
* Email.
* Teléfono.
* DNI o CUIT.
* Fecha.
* Hora.
* Productos.
* SKU.
* Cantidad.
* Precio unitario.
* Subtotal.
* Descuento.
* Costo de envío.
* Total.
* Método de pago.
* ID de pago.
* Estado.
* Stock anterior.
* Stock resultante.
* Dirección o retiro.
* Notas.

Debe aparecer automáticamente en:

```txt
/admin/tickets
```

El administrador debe poder:

* Buscar ticket.
* Filtrar ticket.
* Abrir ticket.
* Imprimir ticket.
* Descargar ticket.
* Cambiar estado operativo.
* Ver historial de cambios.

---

## Cuenta de usuario

```txt
/mi-cuenta
├── /resumen
├── /pedidos
├── /pedidos/:id
├── /compras
├── /pendientes
├── /carrito
├── /favoritos
├── /direcciones
├── /facturacion
├── /ajustes
├── /seguridad
├── /asistencia
└── /conversaciones
```

Mostrar:

* Productos comprados.
* Pedidos pendientes.
* Pedidos pagados.
* Pedidos preparando.
* Pedidos enviados.
* Historial.
* Productos del carrito.
* Favoritos.
* Direcciones.
* Datos fiscales.
* Configuración.
* Cambio de contraseña.
* Sesiones.
* Conversaciones con chatbot.
* Conversaciones con administrador.
* Repetir pedido.
* Descargar ticket.

---

## Chatbot FZAC

Crear chatbot personalizado:

# Asistente FZAC

Diseño:

* Fondo negro.
* Mensajes oscuros.
* Texto amarillo y blanco.
* Botones amarillos.
* Coherente con Materiales FZAC.
* Responsive.
* Sin JSON visible.

Capacidades:

* Conversar naturalmente.
* Mantener historial.
* Responder dudas del cliente.
* Recomendar productos.
* Consultar productos reales desde backend.
* Consultar precio real.
* Consultar stock real.
* Responder sobre pagos.
* Responder sobre entregas.
* Responder sobre retiros.
* Responder sobre pedidos.
* Responder sobre cambios y devoluciones.
* Responder sobre cuenta y registro.
* Asistir con materiales para tareas de obra.
* Derivar a administrador.

No debe:

* Inventar stock.
* Inventar precios.
* Mostrar JSON.
* Mostrar IDs internos.
* Mostrar prompts.
* Mostrar tokens.
* Mostrar variables de entorno.
* Mostrar SQL.
* Mostrar datos privados.
* Mostrar información de otros clientes.

Guardar historial en PostgreSQL.

Implementar rate limit específico del chatbot.

---

## Panel de administración

```txt
/admin
├── /dashboard
├── /productos
├── /productos/nuevo
├── /productos/:id
├── /categorias
├── /pedidos
├── /pedidos/:id
├── /tickets
├── /pagos
├── /clientes
├── /stock
├── /ofertas
├── /cupones
├── /conversaciones
├── /chat
├── /estadisticas
├── /apariencia
├── /configuracion
├── /usuarios-admin
└── /auditoria
```

Dashboard:

* Ventas del día.
* Ventas del mes.
* Pedidos pendientes.
* Pagos aprobados.
* Pagos rechazados.
* Ticket promedio.
* Clientes nuevos.
* Productos activos.
* Productos con bajo stock.
* Productos más vendidos.
* Categorías más vendidas.
* Gráfico de ventas.
* Últimos tickets.
* Últimos pedidos.

CRUD obligatorio:

* Productos.
* Categorías.
* Ofertas.
* Cupones.
* Usuarios.
* Pedidos.
* Inventario.

El CRUD de productos debe permitir modificar:

* Nombre.
* Slug.
* SKU.
* Marca.
* Descripción.
* Precio.
* Precio anterior.
* Stock.
* Stock mínimo.
* Categoría.
* Subcategoría.
* Fotos.
* Galería.
* Especificaciones.
* Destacado.
* Oferta.
* Activo.
* Fecha de publicación.

---

## Módulo de apariencia

Crear panel `/admin/apariencia`.

Permitir modificar desde base de datos:

* Color principal.
* Color secundario.
* Fondo general.
* Fondo del header.
* Fondo de cards.
* Color de texto.
* Color de precio.
* Color de botones.
* Tamaño de tipografía.
* Textos del hero.
* Banners.
* Logo.
* Favicon.
* Footer.
* Links sociales.

Validar formatos.

No permitir CSS arbitrario.
No permitir JavaScript arbitrario.

---

## Base de datos relacional

Crear `schema.prisma`.

Modelos mínimos:

```txt
User
RefreshToken
Address
Category
Subcategory
Product
ProductImage
ProductSpecification
InventoryMovement
Cart
CartItem
Favorite
Order
OrderItem
Payment
PurchaseTicket
PurchaseTicketItem
Coupon
Offer
Review
Conversation
Message
Notification
StoreAppearance
AuditLog
SearchEvent
ProductView
RecommendationEvent
```

Reglas:

* User tiene direcciones.
* User tiene órdenes.
* User tiene carrito.
* User tiene favoritos.
* User tiene conversaciones.
* Category tiene productos.
* Product tiene imágenes.
* Product tiene especificaciones.
* Order tiene ítems.
* Order tiene pagos.
* Order tiene ticket.
* Ticket tiene ítems.
* Conversation tiene mensajes.
* InventoryMovement referencia producto, orden y administrador cuando corresponda.

Usar:

* UUID o CUID.
* Índices.
* Constraints.
* Unique keys.
* Cascadas controladas.
* Timestamps.
* Soft delete donde corresponda.
* `Decimal` para dinero.
* No usar `Float` para precios.

Generar:

* `schema.prisma`.
* Migraciones.
* `schema.sql`.
* Seed realista.
* Admin inicial.
* Usuarios de prueba.
* Categorías.
* Productos.
* Órdenes.
* Tickets.
* Conversaciones.

---

## Rate limits

Implementar:

```txt
Global API:
100 requests cada 15 minutos por IP.

Login:
5 intentos cada 15 minutos.

Registro:
5 intentos por hora.

Recuperación de contraseña:
3 intentos por hora.

Chatbot:
20 mensajes cada 10 minutos por usuario/IP.

Buscador asistido:
30 consultas cada 10 minutos.

Checkout:
10 intentos cada 15 minutos.

Admin:
Límites razonables por sesión.

Webhook Mercado Pago:
No usar límite global.
Validar firma/origen y payload.
```

Responder con errores claros y códigos HTTP correctos.

---

## Seguridad

Implementar:

* Helmet.
* CORS estricto.
* Validación de `.env`.
* JWT seguro.
* Refresh token rotativo.
* bcrypt.
* Cookies httpOnly si aplica.
* SameSite.
* Secure en producción.
* Zod.
* Rate limit.
* Sanitización.
* Roles.
* Rutas protegidas.
* Webhook seguro.
* Verificación de montos.
* Transacciones Prisma.
* Auditoría.
* Logs sin secretos.
* Prevención de enumeración de usuarios.
* Validación de archivos.
* Límites de tamaño.
* MIME types permitidos.
* No exponer stack traces en producción.

---

## API REST

Rutas versionadas:

```txt
/api/v1/auth
/api/v1/users
/api/v1/products
/api/v1/categories
/api/v1/cart
/api/v1/orders
/api/v1/checkout
/api/v1/payments
/api/v1/tickets
/api/v1/offers
/api/v1/favorites
/api/v1/reviews
/api/v1/assistant
/api/v1/conversations
/api/v1/recommendations
/api/v1/admin
/api/v1/appearance
/api/v1/analytics
/api/v1/webhooks/mercadopago
```

Formato uniforme:

```json
{
  "success": true,
  "data": {},
  "message": "Operación completada"
}
```

Errores:

```json
{
  "success": false,
  "message": "Mensaje legible",
  "errors": []
}
```

No exponer información interna.

---

## Conexión frontend-backend

Crear cliente Axios central con:

* Base URL.
* Timeout.
* Access token.
* Refresh automático.
* Manejo de 401.
* Reintento controlado.
* Cancelación.
* Errores normalizados.

Usar React Query para:

* Productos.
* Categorías.
* Ofertas.
* Pedidos.
* Tickets.
* Perfil.
* Dashboard.
* Estadísticas.
* Chatbot.
* Apariencia.

No dejar módulos visuales desconectados del servidor.

Mocks solo si:

```env
VITE_ENABLE_API_MOCKS="true"
```

---

## Footer

Incluir:

* Logo Materiales FZAC.
* Descripción.
* Categorías.
* Mi cuenta.
* Mis pedidos.
* Cómo comprar.
* Envíos y retiros.
* Medios de pago.
* Preguntas frecuentes.
* Términos y condiciones.
* Política de privacidad.
* Cambios y devoluciones.
* Instagram.
* WhatsApp.
* Email.
* Portfolio FZAC.
* Copyright.
* Métodos de pago.

Datos:

```txt
Email:
fortalezaconstruccionesrosario@gmail.com

Instagram:
@fzaconstrucciones

WhatsApp:
+54 9 341 584 7000

Portfolio:
https://fzac-portfolio-jek3.vercel.app
```

WhatsApp es contacto auxiliar, no mecanismo de confirmación de compras.

---

## Scripts esperados

Desde la raíz:

```bash
npm run install:all
npm run dev
npm run dev:client
npm run dev:server
npm run build
npm run prisma:generate
npm run db:migrate
npm run db:seed
npm run test
npm run lint
```

---

## Reglas para Codex

1. Antes de modificar, revisar estructura actual.
2. No reemplazar módulos enteros si se puede extender correctamente.
3. Si falta arquitectura, crearla de forma modular.
4. No duplicar lógica.
5. No dejar imports rotos.
6. No dejar componentes sin exportar.
7. No dejar rutas sin registrar.
8. No dejar endpoints sin validación.
9. No usar credenciales reales.
10. No modificar `.env` real.
11. No subir secretos.
12. No exponer JSON en el chatbot.
13. No inventar stock ni precios.
14. No confirmar pagos desde frontend.
15. No descontar stock sin webhook aprobado.
16. No crear admin hardcodeado en React.
17. No dejar botones sin funcionalidad.
18. No usar `Float` para dinero.
19. No romper responsive.
20. Mantener siempre la identidad Materiales FZAC.

---

## Entrega esperada

El proyecto debe quedar:

* Ejecutable.
* Con frontend conectado al backend.
* Con backend conectado a Supabase.
* Con Prisma funcional.
* Con Mercado Pago preparado.
* Con Google Auth por Supabase.
* Con chatbot funcional.
* Con panel admin protegido.
* Con CRUD real.
* Con tickets automáticos.
* Con rate limits.
* Con validaciones.
* Con diseño e-commerce industrial premium.
* Con README claro.
* Con `.env.example`.
* Con seed realista.
* Con código mantenible.
