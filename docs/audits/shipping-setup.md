# Configuración segura de Google Maps y envíos

Estado verificado el 17 de septiembre de 2026.

## Estado comprobado

- El navegador usa exclusivamente `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` para
  Maps JavaScript API y el widget legacy `google.maps.places.Autocomplete`.
- El backend usa exclusivamente `GOOGLE_MAPS_SERVER_KEY` para Routes API.
- Una prueba controlada contra Render devolvió una distancia positiva desde
  Routes API sin filtrar credenciales. Esto confirma que la server key llega al
  proceso y que Google acepta la llamada desde el egreso actual de Render.
- La tarifa comercial productiva no está completa o no es válida. Delivery falla
  cerrado con `422`, monto cero y alternativa de retiro/WhatsApp.
- El código no llama a Google cuando falta cualquier componente de la tarifa.
- El checkout vuelve a calcular productos, subtotal, distancia, envío y total en
  servidor antes de crear la orden o iniciar Mercado Pago.

## Restricciones esperadas

### Server key

- Application restriction: **IP addresses**.
- Egresos declarados por el propietario: los dos CIDR de Render documentados en
  el panel de Google Cloud.
- API restriction: **Routes API** únicamente.
- Variable en Render: `GOOGLE_MAPS_SERVER_KEY`, `sync: false`.

Las restricciones exactas del panel Google Cloud requieren validación manual del
propietario; el repositorio no tiene acceso administrativo a esa consola.

### Browser key

- Application restriction: **HTTP referrers / Websites**.
- Referers actuales:
  - `http://localhost:*/*`
  - `http://127.0.0.1:*/*`
  - `https://materiales-fzac-8xmp.onrender.com/*`
- Cuando los dominios estén realmente activos, agregar:
  - `https://materialesfzac.com/*`
  - `https://www.materialesfzac.com/*`
- API restrictions actuales necesarias por el código:
  - **Maps JavaScript API**
  - **Places API**, porque se usa el widget legacy `Autocomplete`

No habilitar Places API (New) por suposición. Solo será necesaria al migrar al
widget nuevo `PlaceAutocompleteElement`.

## Tarifa comercial

La cotización exige las cinco variables siguientes; ninguna tiene fallback
comercial silencioso:

- `FZAC_SHIPPING_BASE_PRICE`
- `FZAC_SHIPPING_PRICE_PER_KM`
- `FZAC_SHIPPING_MIN_PRICE`
- `FZAC_SHIPPING_ROUND_TO`
- `FZAC_SHIPPING_MAX_KM`

La fórmula implementada es:

```text
importe = redondear_hacia_arriba(max(mínimo, base + distancia_km × precio_por_km), redondeo)
```

Los valores deben ser finitos y no negativos; redondeo y radio deben ser mayores
que cero. Distancia cero, fuera de radio, NaN, infinito o desbordes fallan cerrado.
No cargar valores de ejemplo en Render.

## Procedimiento manual de activación

1. Completar las cinco variables con la tarifa comercial aprobada.
2. Confirmar `FZAC_STORE_ADDRESS` en Render.
3. Verificar las restricciones de ambas claves en Google Cloud.
4. Desplegar mediante PR aprobado; no editar `main` directamente.
5. Iniciar sesión con una cuenta QA.
6. Probar retiro, dirección de Rosario, dirección incompleta, fuera de radio y
   timeout simulado.
7. Confirmar que el total persistido coincide con el recálculo server-side.
8. Revisar métricas y cuotas de Routes API sin copiar credenciales a logs.
