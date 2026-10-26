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

## Tarifa horaria acordada — propuesta 26/10/2026 (no desplegada)

- La política comercial ahora es **aproximadamente ARS 40.000 por hora**, con **mínimo de una hora**, incluyendo ida, descarga y regreso al depósito.
- No se toma ARS 40.000 como valor exacto de producción sin confirmación final en variables.
- La implementación en esta rama usa la duración de **ida** de Google Routes, la duplica como aproximación de regreso y suma los minutos de descarga configurados.
- **El tiempo de descarga sigue pendiente de definición**: no hay un número predeterminado inventado.
- La distancia de Google Routes continúa comprobando el radio de reparto (por defecto 30 km de ida).
- Fórmula: `importe = ceil(max(60, 2 * minutos_ida + minutos_descarga) / 60 * tarifa_hora / redondeo) * redondeo`.
- No se descuenta stock ni se confirma un pago por el mero cálculo del envío.
- Si falta el precio por hora o los minutos de descarga, o Google Routes no devuelve una duración válida, se bloquea la cotización automática con importe cero y se deriva a coordinación por WhatsApp.

Nuevas variables privadas para Vercel:

- `FZAC_SHIPPING_PRICE_PER_HOUR`: tarifa definitiva; importe orientativo informado por el comercio: 40000 ARS/h
- `FZAC_SHIPPING_UNLOAD_MINUTES`: tiempo operativo promedio de descarga, por confirmar
- `FZAC_SHIPPING_ROUND_TO`: redondeo monetario, valor técnico 10
- `FZAC_SHIPPING_MAX_KM`: cobertura máxima medida por recorrido de ida; por defecto 30
- `FZAC_STORE_ADDRESS`: origen de Google Routes

Las anteriores `FZAC_SHIPPING_BASE_PRICE`, `FZAC_SHIPPING_PRICE_PER_KM` y `FZAC_SHIPPING_MIN_PRICE` ya no participan del cálculo en esta rama. No borrarlas de producción hasta validar la migración.

Antes de habilitar delivery, verificar disponibilidad de Google Routes, fijar minutos de descarga con el comercio, probar cotizaciones de distintos destinos (ida y regreso real pueden diferir) y revisar capacidad de reparto. Merchant Center no puede representar esta tarifa horaria por distancia exacta y no se debe publicar una tarifa nacional engañosa.
