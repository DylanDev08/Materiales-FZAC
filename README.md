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

## Integracion Mercado Pago - Modo Prueba

1. Crear una aplicacion en Mercado Pago Developers.
2. Elegir integracion web y copiar las credenciales de prueba desde el panel.
3. En `.env.local`, completar `MERCADOPAGO_ACCESS_TOKEN` y `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`.
4. Activar `PAYMENTS_ENABLED=true`.
5. Usar `PAYMENTS_ENV=test` y `PAYMENTS_PROVIDER=mercadopago`.
6. Ejecutar `npm install` y luego `npm run dev`.
7. Agregar un producto al carrito y completar checkout.
8. Elegir “Pagar con Mercado Pago” para crear la preferencia y redirigir al checkout de prueba.
9. Pagar con un usuario comprador de prueba distinto a la cuenta vendedora.
10. Verificar en admin que el pedido, pago, stock, ticket y notificaciones cambien segun el estado confirmado.
11. Para probar webhook local usar ngrok o desplegar en Vercel; Mercado Pago no puede notificar directamente a `localhost`.
12. Configurar en Mercado Pago el webhook publico: `https://DOMINIO/api/webhooks/mercadopago`.
13. Eventos recomendados: pagos y ordenes comerciales si estan disponibles para la cuenta.

No guardar en README, codigo ni archivos versionados: Access Token, usuarios de prueba, contrasenas o codigos de verificacion.

## Pasar A Produccion

1. Cambiar el Access Token por la credencial productiva.
2. Cambiar la Public Key por la credencial productiva.
3. Configurar `PAYMENTS_ENV=production`.
4. Mantener `PAYMENTS_ENABLED=true`.
5. Configurar el webhook publico: `https://DOMINIO/api/webhooks/mercadopago`.
6. Probar una compra real de bajo monto.
7. Verificar admin, pagos, eventos, tickets y stock.

## Estado Del Proyecto

La base de la tienda ya esta preparada como e-commerce real: catalogo, checkout, auth, admin, storage, stock, pagos externos y webhook. Para operar comercialmente solo resta cargar credenciales reales del proveedor de pagos, datos definitivos del negocio y productos finales.

## Deploy En Render

El proyecto se despliega como un unico **Web Service de Next.js**. La interfaz, las APIs, el checkout, la autenticacion y los webhooks forman parte de la misma aplicacion y no deben separarse en dos servicios.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/DylanDev08/Materiales-FZAC)

El Blueprint incluido en `render.yaml` configura:

- instalacion reproducible con `npm ci`;
- build de produccion con `npm run build`;
- servidor Next.js escuchando en todas las interfaces;
- health check publico en `/api/health`;
- despliegues automaticos desde `main`;
- variables publicas y secretos requeridos por Supabase, Mercado Pago y el panel administrativo.

Al crear el servicio en Render hay que completar las variables marcadas como secretas. Mercado Pago queda desactivado de forma segura hasta cargar credenciales validas y habilitar `PAYMENTS_ENABLED=true`.


# Como correr el proyecto
```bash
npm run dev
npm run lint
```
