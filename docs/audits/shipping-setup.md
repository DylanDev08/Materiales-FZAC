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

## Tarifa comercial pendiente

Variables preparadas:

- `FZAC_SHIPPING_BASE_PRICE`: pendiente de aprobación.
- `FZAC_SHIPPING_PRICE_PER_KM`: pendiente de aprobación.
- `FZAC_SHIPPING_MIN_PRICE`: pendiente de aprobación.
- `FZAC_SHIPPING_ROUND_TO`: valor técnico actual `10`; revisar junto con la tarifa.
- `FZAC_SHIPPING_MAX_KM`: valor técnico actual `30`; requiere confirmación comercial antes de habilitar delivery.
- `FZAC_STORE_ADDRESS`: `Hermana Paula 3164, Rosario, Santa Fe, Argentina`.

Fórmula ya implementada, pero inactiva hasta definir base y precio por kilómetro:

```text
importe = redondear_hacia_arriba(max(mínimo, base + distancia_km × precio_por_km), redondeo)
```

No deben cargarse importes de ejemplo en Render. Después de recibir los cinco valores aprobados, cargarlos como variables privadas, desplegar y probar retiro, dirección válida, dirección inválida, timeout, fuera de radio y error de Google antes de habilitar compras con delivery.
