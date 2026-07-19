# Operacion segura de Materiales FZAC

Esta guia describe la configuracion operativa sin incluir credenciales reales. Los secretos deben cargarse en `.env` local o en el administrador de variables del deploy y nunca versionarse.

## Mercado Pago en prueba

Variables requeridas:

```env
PAYMENTS_ENABLED=true
PAYMENTS_ENV=test
PAYMENTS_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=https://DOMINIO-DE-PRUEBA
```

1. Usar credenciales de la misma aplicacion y ambiente.
2. Reiniciar Next.js despues de cambiar variables.
3. Comprar con un usuario comprador TESTUSER distinto de la cuenta vendedora.
4. Mercado Pago debe ser el unico metodo que devuelve `redirect_url`.
5. Transferencia y WhatsApp deben crear el pedido sin abrir Mercado Pago.
6. Configurar el webhook publico en `https://DOMINIO/api/webhooks/mercadopago`.
7. Para local, exponer temporalmente el servidor con un tunel HTTPS; Mercado Pago no puede notificar a `localhost`.
8. Revisar los eventos desde Admin > Comprobantes de pago.

En produccion, usar `PAYMENTS_ENV=production`, URL HTTPS publica y `MERCADOPAGO_WEBHOOK_SECRET`. La aplicacion rechaza webhooks sin firma y pagos cuyo `live_mode` no coincide con el ambiente.

## Migracion de integridad

Antes de habilitar pagos o reembolsos en un entorno nuevo, aplicar:

```text
supabase/migrations/20260719000000_payment_integrity_and_profile_guard.sql
```

La migracion es aditiva. Protege `profiles.role` y agrega las RPC atomicas que confirman pagos, descuentan o restituyen stock y evitan tickets duplicados. El boton de reembolso se bloquea antes de llamar a Mercado Pago cuando la RPC no esta disponible.

## Reembolso de prueba

1. Crear y aprobar un pago de Mercado Pago de prueba.
2. Abrir Admin > Pagos y seleccionar el movimiento.
3. Elegir `Gestionar reembolso`.
4. Seleccionar motivo, escribir el detalle y confirmar una sola vez.
5. Comprobar pago `Reembolsado`, pedido cancelado, ticket cancelado, movimiento `RETURN`, stock restituido, notificacion y auditoria.

Solo se ejecutan reembolsos totales. Mercado Pago exige saldo disponible y aplica sus plazos operativos.

## Login y registro manual

1. Abrir `/registro` y crear una cuenta con nombre, email, telefono y contrasena.
2. Confirmar el email desde el enlace recibido.
3. Ingresar en `/login` con email y contrasena.
4. Verificar que Google OAuth siga disponible como alternativa.
5. Un email solo obtiene rol admin cuando figura en `ADMIN_EMAILS`; el rol guardado no reemplaza esa lista en la aplicacion.

## Sender y recuperacion

Variables server-side:

```env
SENDER_API_KEY=
SENDER_FROM_EMAIL=
SENDER_FROM_NAME=Materiales FZAC
```

`SENDER_FROM_EMAIL` debe pertenecer a un dominio verificado en Sender con SPF, DKIM y DMARC. La API Key nunca lleva prefijo `NEXT_PUBLIC_`.

1. Abrir `/recuperar` y solicitar el enlace.
2. La respuesta siempre es generica para evitar enumerar cuentas.
3. Supabase genera el token temporal; Sender solo transporta el email.
4. Abrir el enlace, definir la nueva contrasena en `/restablecer` y volver a iniciar sesion.
5. Si Sender no esta configurado o falla, el backend usa el email nativo de Supabase.

## Administradores

```env
ADMIN_EMAILS=email-admin-1@dominio.com,email-admin-2@dominio.com
ADMIN_CONSOLE_PATH=/ruta-privada
```

La ruta discreta no reemplaza la seguridad: el layout valida sesion y rol en servidor y las APIs administrativas repiten la autorizacion.

## Chatbot

Probar al menos:

- `Hola`.
- `Que precio tiene el cemento`.
- `Hay stock de placas`.
- `Necesito materiales para una pared`.
- `Como pago por transferencia`.
- `Quiero ver mi pedido` con y sin sesion.
- Un producto inexistente dos veces para validar el seguimiento.

Cada respuesta debe devolver cuatro acciones, no inventar precios o stock y consultar solo pedidos del usuario autenticado.

## Comandos de control

```bash
npm run security:check
npm run typecheck
npm run lint
npm run build
```
