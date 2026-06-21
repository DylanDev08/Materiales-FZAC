# Arquitectura de Materiales FZAC

## Flujo principal

```text
Cliente React
   │
   ├── Catálogo / búsqueda / recomendaciones
   ├── Auth local o Google
   ├── Carrito local o persistido
   └── Checkout
           │
           ▼
API Express
   │
   ├── Validaciones y rate limit
   ├── JWT / roles
   ├── Servicios y repositorios
   ├── Stripe Checkout
   ├── Asistente OpenAI
   ├── Cloudinary
   └── Nodemailer
           │
           ▼
Prisma ORM ─────► PostgreSQL / Supabase
```

## Dominios

### Catálogo
- Categorías y subcategorías.
- Productos, galería, especificaciones, precio y stock.
- Favoritos.
- Eventos de vista, carrito, favorito y checkout.
- Estadísticas y recomendaciones.

### Identidad
- Usuario local con contraseña bcrypt.
- Usuario Google validado contra Supabase Auth.
- Access token JWT corto.
- Refresh token almacenado en cookie segura y en DB.
- Roles de usuario, operador y administrador.

### Comercio
- Carrito persistido por usuario.
- Orden pendiente de pago.
- Checkout Stripe.
- Webhook como fuente de verdad de la aprobación.
- Descuento de stock dentro de una transacción.
- Estados de preparación, retiro, envío y entrega.

### Atención
- Chat IA para visitantes o usuarios.
- Historial persistido.
- Contexto de catálogo.
- Recomendaciones.
- Derivación a soporte y respuesta desde el panel admin.

### Administración
- Métricas.
- Pedidos.
- Productos y categorías.
- Clientes.
- Inventario y stock bajo.
- Analítica de búsquedas y productos.
- Auditoría.

## Directorios principales

```text
client/src/
├── api/          Adaptadores HTTP y Supabase
├── components/   UI reutilizable, layout y asistente
├── context/      Auth y carrito
├── pages/        Rutas funcionales
├── styles/       Sistema visual FZAC
└── data/         Fallback visual para desarrollo

server/src/
├── config/       Variables e integraciones
├── controllers/  Entrada HTTP
├── middleware/   Auth, roles, validación y seguridad
├── repositories/ Acceso a Prisma
├── routes/       Contratos API
├── services/     Lógica de negocio
├── prisma/       Modelos, migraciones y seed
└── utils/        Errores, tokens y serialización
```

## Estrategia de datos frontend

El catálogo intenta consumir la API. Cuando `VITE_ENABLE_API_MOCKS=true` y el backend no está disponible, utiliza el catálogo fotográfico de fallback para continuar desarrollando la interfaz. En producción debe configurarse como `false`.
