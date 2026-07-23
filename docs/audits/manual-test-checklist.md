# Checklist manual pre-produccion - Materiales FZAC

Usar este checklist antes de cada deploy importante.

## Setup

- [ ] Confirmar rama y commit a desplegar.
- [ ] Confirmar `NEXT_PUBLIC_SITE_URL` con URL real de Render/dominio.
- [ ] Confirmar `PAYMENTS_ENABLED=true`.
- [ ] Confirmar `PAYMENTS_ENV=test` o `production` segun corresponda.
- [ ] Confirmar que no se subio `.env`.
- [ ] Confirmar que las credenciales de Mercado Pago pertenecen al mismo entorno.
- [ ] Reiniciar servicio Render despues de cambiar variables.

## Rutas publicas

- [ ] `/` carga sin pantalla blanca.
- [ ] `/productos` carga productos.
- [ ] `/categorias` carga rubros.
- [ ] `/carrito` carga.
- [ ] `/checkout` carga sin producto y con producto.
- [ ] `/login` carga.
- [ ] `/registro` carga.
- [ ] `/register` redirige a `/registro`.
- [ ] `/terminos` carga.
- [ ] `/privacidad` carga.
- [ ] `/arrepentimiento` carga.
- [ ] `/admin` no expone panel directamente.

## Botones y links

- [ ] Header: logo lleva al home.
- [ ] Header: Productos lleva a `/productos`.
- [ ] Header: carrito abre `/carrito`.
- [ ] Header: cuenta/login funcionan.
- [ ] Home: Comprar materiales lleva al catalogo.
- [ ] Home: Ver ofertas filtra o navega correctamente.
- [ ] Home/Footer: Boton de arrepentimiento lleva a `/arrepentimiento`.
- [ ] Footer: terminos, privacidad, cambios/devoluciones funcionan.
- [ ] WhatsApp abre `https://wa.me/` con numero correcto.

## Productos y carrito

- [ ] Abrir detalle de un producto.
- [ ] Agregar producto al carrito.
- [ ] Cambiar cantidad.
- [ ] Quitar producto.
- [ ] Producto sin stock no permite comprar.
- [ ] Stock bajo muestra aviso claro.
- [ ] El carrito conserva datos al navegar.

## Checkout

- [ ] La consola Admin > Sistema informa `Checkout transaccional: Atomico`.
- [ ] La consola Admin > Sistema informa `Idempotencia en base: Protegida`.
- [ ] Retiro no exige direccion completa.
- [ ] Envio exige direccion.
- [ ] Errores aparecen debajo del campo.
- [ ] Boton principal queda disabled mientras procesa.
- [ ] Pantalla de carga aparece al crear pedido.
- [ ] Doble click no crea doble pedido.
- [ ] Misma `idempotency_key` devuelve misma orden/pago.
- [ ] Stock/precio se validan en backend.
- [ ] Cambiar productos, metodo, entrega o datos del comprador invalida la clave del intento anterior.
- [ ] Reutilizar una clave con otro contenido devuelve `IDEMPOTENCY_CONFLICT` y no crea registros.

## Pagos

- [ ] Mercado Pago solo aparece/redirige cuando `payment_method=MERCADOPAGO`.
- [ ] En `PAYMENTS_ENV=test`, el checkout muestra aviso de entorno de prueba.
- [ ] Mercado Pago usa comprador TESTUSER, no cuenta real ni vendedor.
- [ ] Transferencia no abre Mercado Pago.
- [ ] Transferencia crea pedido pendiente.
- [ ] WhatsApp no abre Mercado Pago.
- [ ] WhatsApp crea pedido y devuelve URL de WhatsApp.
- [ ] Compra grande queda en revision administrativa.
- [ ] Pago rechazado muestra mensaje humano.
- [ ] Pago pendiente muestra pantalla de pendiente.
- [ ] Pago aprobado genera comprobante/ticket solo despues de confirmacion.

## Webhook Mercado Pago

- [ ] Webhook configurado a `https://DOMINIO/api/webhooks/mercadopago`.
- [ ] Eventos recomendados habilitados en Mercado Pago.
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` configurado en produccion.
- [ ] Produccion rechaza webhook sin firma valida.
- [ ] Test/dev puede registrar warning sin secret.
- [ ] Webhook aprobado no descuenta stock dos veces.
- [ ] Webhook rechazado/cancelado no emite ticket.

## Admin

- [ ] Anonimo no entra a admin.
- [ ] Usuario comun no entra a admin.
- [ ] Admin autorizado entra al panel.
- [ ] APIs admin anonimas devuelven 401/403.
- [ ] Dashboard no muestra UUIDs largos como dato principal.
- [ ] Pagos muestran medio en lenguaje humano.
- [ ] Reembolso solo aparece para pagos aprobados.
- [ ] Reembolso pide motivo.
- [ ] Reembolso no puede ejecutarse dos veces.

## Legal y confianza

- [ ] Boton de arrepentimiento visible desde home/footer.
- [ ] Terminos tienen logo FZAC.
- [ ] Privacidad visible.
- [ ] Cambios/devoluciones visibles.
- [ ] Se informa que FZAC no guarda datos de tarjeta.
- [ ] Datos de contacto visibles.
- [ ] Revisar textos legales con profesional antes de produccion final.

## Seguridad

- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo server-side.
- [ ] `MERCADOPAGO_ACCESS_TOKEN` solo server-side.
- [ ] No hay tokens en consola del navegador.
- [ ] No hay stack traces al usuario.
- [ ] Admin tiene `X-Robots-Tag: noindex`.
- [ ] Headers `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS en produccion.
- [ ] CSP revisada o pendiente documentada.

## Mobile y accesibilidad

- [ ] Home usable en 390px.
- [ ] Productos no desbordan.
- [ ] Checkout mobile no tiene botones pegados.
- [ ] Inputs tienen label.
- [ ] Focus visible por teclado.
- [ ] Imagenes principales tienen `alt`.
- [ ] Modales legales se pueden cerrar y scrollear.

## Comandos

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev`
- [ ] `npm run test:e2e`

Las pruebas E2E normales son de solo lectura o usan estado local del navegador. Para habilitar pruebas que crean pedidos se requieren explicitamente `RUN_MUTATING_CHECKOUT_TESTS=true`, `PLAYWRIGHT_AUTH_STATE`, `QA_CHECKOUT_EMAIL` y `QA_CHECKOUT_PRODUCT_ID`. En un host remoto tambien se requiere `QA_ALLOW_REMOTE_WRITES=true`; usar un proyecto/cuenta QA y limpiar los datos generados.

