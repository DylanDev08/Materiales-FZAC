# Configuración segura de Google Maps y envíos

Estado verificado el 15 de septiembre de 2026.

## Estado de producción

- La clave de navegador está separada en `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` y se usa únicamente para Places/autocomplete.
- La clave server está separada en `GOOGLE_MAPS_SERVER_KEY` y no se incorpora al bundle público.
- La llamada server-side a Routes API llega a Google, pero Google la rechaza porque la credencial tiene una restricción de HTTP referrer (`API_KEY_HTTP_REFERRER_BLOCKED`).
- La tarifa comercial no está configurada. No se activó ningún importe supuesto.
- Retiro permanece en $0.
- Delivery responde `422`, monto `0`, impide continuar al pago y ofrece retiro o coordinación por WhatsApp mientras falte una cotización real.

## Corrección manual de la clave server

Proyecto Google Cloud: `fzac-manejo-de-obras`.

1. Abrir Google Cloud Console → **APIs & Services** → **Credentials**.
2. Identificar la credencial que Render usa como `GOOGLE_MAPS_SERVER_KEY`. No modificar la clave browser.
3. En **Application restrictions**, quitar **HTTP referrers**.
4. Si Render dispone de IP de salida fija, elegir **IP addresses** y registrar exclusivamente esa IP. Si el servicio no dispone de egreso estático, dejar temporalmente **None** y compensar con la restricción estricta de API del paso siguiente.
5. En **API restrictions**, elegir **Restrict key** y permitir únicamente **Routes API**.
6. Confirmar que Routes API esté habilitada y que el proyecto tenga facturación válida.
7. Guardar sin copiar ni registrar la clave en tickets, documentación o logs.
8. Volver a probar `POST /api/shipping/quote` con una dirección completa de Rosario. El error de credencial debe desaparecer; mientras la tarifa siga vacía, la respuesta correcta continúa siendo `422` y monto `0`, pero puede incluir la distancia verificada.

La browser key debe conservar restricciones HTTP referrer para el dominio de producción y desarrollo autorizado, y limitarse a Maps JavaScript API/Places API según el uso real. Nunca debe reutilizarse como server key.

## Envíos por hora y descarga específica por producto — propuesta 26/10/2026 (no desplegada)

Regla comercial informada: aproximadamente **ARS 40.000 por hora de vehículo**, mínimo una hora. El período facturable incluye ida, descarga y regreso al depósito. **La descarga depende de los materiales**, por lo que no se aplica un único tiempo global.

### Datos y política de seguridad

- Variable privada `FZAC_SHIPPING_PRICE_PER_HOUR`: tarifa real confirmada por el comercio; el valor orientativo 40000 no se configura por defecto.
- Variable privada `FZAC_SHIPPING_ROUND_TO`: múltiplo de redondeo monetario (técnicamente 10 por defecto).
- Variable privada `FZAC_SHIPPING_MAX_KM`: radio máximo de recorrido de ida (por defecto 30 km).
- Cada producto debe tener `specifications.shipping_unload_minutes_per_unit` como número entre 0 y 240, **validado por logística**. Multiplicamos por la cantidad de cada SKU y sumamos. No se deduce de nombre, peso o categoría sin datos aprobados.
- Los productos que requieran tratamiento especial pueden tener `specifications.shipping_requires_manual_quote = true`.
- Si falta una especificación, es inválida, el carrito incluye tratamiento especial, o el total de descarga supera 480 minutos, la cotización automática queda **no disponible**, importe 0 y coordinación por WhatsApp. No se confirma el pedido/pago online con importe 0 de envío.
- Evitar asignar 0 minutos por defecto a cualquier producto. Cero puede ser válido únicamente si logística lo aprueba expresamente para ese SKU.
- El presupuesto usa `duración estimada ida × 2 + minutos de descarga de todo el carrito`. El regreso real puede diferir y el estimado debe revisarse con recorridos habituales.
- El cálculo completo será `ceil(max(60, 2*minutos_ida + minutos_descarga) / 60 * tarifa_por_hora / redondeo) * redondeo`. Se cobra al menos una hora.
- El backend resuelve los productos y especificaciones desde Supabase; el navegador solo envía ID y cantidad. El cálculo se repite al crear la orden. La caché incluye los minutos de descarga del carrito.
- Si cambia el carrito, la UI invalida el precio de envío previamente mostrado.
- La cotización automática depende de Google Routes con clave server-side; mantener el fallback por errores de API. El retiro es gratuito.

### Despliegue pendiente

1. Confirmar precio por hora definitivo y etiquetar explícitamente los tiempos de descarga de los productos que FZAC quiera cotizar automáticamente.
2. Revisar los productos pesados, largos, frágiles y pedidos voluminosos para marcarlos como manuales cuando corresponda. El panel administrativo de productos ahora incluye **Cotización de envío** y **Minutos de descarga por unidad** dentro de Opciones avanzadas, sin tener que editar JSON.
3. Cargar `FZAC_SHIPPING_PRICE_PER_HOUR` en Vercel Production **solo después** de aprobar la tarifa. No se requiere el viejo `FZAC_SHIPPING_UNLOAD_MINUTES`.
4. Verificar que `GOOGLE_MAPS_SERVER_KEY` funciona con Routes API (ver auditoría del 15/09 anterior).
5. Probar cotización precompra y recotización al crear orden; precio coincidente, carritos mixtos, cambios de cantidad, errores de Google, fuera de cobertura y retiros.
6. No fusionar ni desplegar antes del QA. Merchant Center requiere una política de costos y cobertura representativa; no anunciar tarifa nacional fija falsa.

Las variables viejas por kilómetro (`FZAC_SHIPPING_BASE_PRICE`, `FZAC_SHIPPING_PRICE_PER_KM`, `FZAC_SHIPPING_MIN_PRICE`) dejan de participar en esta rama y deberán limpiarse únicamente tras el despliegue validado.
