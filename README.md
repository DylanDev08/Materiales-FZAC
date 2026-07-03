# Materiales FZAC

Materiales FZAC es un e-commerce profesional para Fortaleza Construcciones Rosario. La app permite publicar productos de corralon, vender online, validar stock real, gestionar pedidos y centralizar la operacion comercial desde un panel administrativo.

El proyecto esta pensado para pasar de una tienda basica a una plataforma lista para operar en produccion: catalogo, carrito, checkout, pagos externos, usuarios, panel admin, notificaciones, tickets, gestion de stock y contacto comercial.

## Que Hace

- Muestra un catalogo de materiales organizado por productos, categorias, marcas, ofertas y destacados.
- Permite al cliente buscar productos, agregarlos al carrito y completar un checkout seguro.
- Valida precios y stock desde servidor antes de crear una orden.
- Prepara el flujo de pago con proveedor externo sin guardar tarjetas ni datos sensibles.
- Genera pedidos pendientes, pagos, tickets y movimientos de inventario cuando corresponde.
- Ofrece cuenta de usuario con datos personales, pedidos, productos comprados y conversaciones.
- Incluye panel administrativo para gestionar productos, clientes, pedidos, pagos, tickets, stock, chats y metricas.
- Integra contacto por WhatsApp y un chatbot FZAC para orientar compras, stock, envios, pagos y consultas frecuentes.
- Incluye secciones legales y comerciales: terminos, privacidad, medios de pago, envios, retiros, cambios y devoluciones.

## Tecnologias

- Next.js App Router.
- React.
- TypeScript.
- Supabase Database.
- Supabase Auth.
- Supabase Storage.
- PostgreSQL con RLS.
- Route Handlers server-side.
- Mercado Pago preparado para Checkout Pro y webhooks.
- CSS modular con identidad visual FZAC.
- Zod para validaciones.
- Lucide React para iconografia.

## Problemas Que Resuelve

- Evita vender productos sin stock validando la disponibilidad real antes del pago.
- Evita confiar en precios enviados desde frontend: el total se recalcula en servidor.
- Evita descuentos duplicados de stock con confirmacion idempotente de pagos.
- Evita exponer claves privadas usando operaciones sensibles solo del lado servidor.
- Evita un panel administrativo expuesto mediante proteccion de rol y rutas privadas.
- Ordena la gestion diaria del negocio: pedidos, clientes, pagos, tickets, inventario y notificaciones.
- Mejora la experiencia mobile para compras rapidas desde celular.
- Permite operar aunque el proveedor de pagos todavia no este conectado, dejando las ordenes preparadas y controladas.

## Modulos Principales

- Home comercial con identidad FZAC.
- Catalogo y detalle de producto.
- Carrito persistente.
- Checkout con validacion de stock.
- Flujo de pagos preparado para produccion.
- Webhook de confirmacion de pagos.
- Panel de administracion.
- Gestion de productos e imagenes.
- Vista de clientes y pedidos.
- Cuenta de usuario.
- Chatbot y contacto comercial.
- Paginas legales.

## Enfoque De Seguridad

La app separa responsabilidades entre cliente y servidor. El frontend solo captura interacciones del usuario; las decisiones importantes, como validar stock, recalcular precios, crear ordenes, confirmar pagos, descontar inventario y emitir tickets, se hacen en backend.

No se documentan claves, tokens ni credenciales privadas dentro del repositorio. La configuracion sensible debe gestionarse desde el entorno seguro del deploy o del equipo responsable.

## Estado Del Proyecto

La base de la tienda ya esta preparada como e-commerce real: catalogo, checkout, auth, admin, storage, stock, pagos externos y webhook. Para operar comercialmente solo resta cargar credenciales reales del proveedor de pagos, datos definitivos del negocio y productos finales.
