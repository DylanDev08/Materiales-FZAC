# PR #47: validación y pendientes de producción

Revisión del 28/10/2026 sobre `9abc1cb` y los cambios de QA de este corte. Estado: **no listo para liberar el flujo completo de producción**. No se hizo merge ni se inició un despliegue manual.

## Matriz de cierre

| Área | Evidencia disponible | Validación pendiente y requisito |
| --- | --- | --- |
| Calidad y seguridad | Quality Gate, CodeQL y 9/9 E2E en el head anterior. En este corte: 40/40 unitarias, 11/11 E2E de solo lectura, TypeScript, build, integridad del asistente y controles de seguridad locales aprobados. Lint sin errores, con dos warnings preexistentes. | Confirmar CI del nuevo commit; repetir sobre cualquier combinación posterior con `main`. Los resultados anteriores no certifican otro SHA. |
| Login y checkout | Recorrido público hasta login documentado el 27/10. Smoke autenticado actualizado al contrato actual: transferencia, idempotencia, rechazo de WhatsApp como pago y preferencia sandbox. | Ejecutar el smoke con servidor y base aislados, credenciales de Supabase y Mercado Pago de prueba. Luego verificar en navegador login → checkout, conservación del carrito, importes y stock. **El smoke actualizado no se ejecutó con credenciales en este corte.** |
| Retorno y notificaciones | Pruebas unitarias de firma, importes/moneda, estados y claves de deduplicación. E2E comprueba bloqueo anónimo de conciliación y rechazo de JSON/IDs inválidos en ambos webhooks. | Pago sandbox aprobado, rechazado y pendiente; retorno al sitio y notificación auténtica, conciliación de pedido/pago/stock/comprobante y reintentos sin duplicados. Se necesitan cuentas y webhook de pruebas; ninguna prueba aislada certifica esa integración. |
| Envíos | Unitarias del cálculo horario y E2E de entradas inválidas. Consulta real de solo lectura: 122 productos activos; **0 con descarga por unidad válida**; 4 con `IN_STOCK` y stock bruto positivo, sin descontar reservas. | FZAC debe validar tarifa horaria y tiempos por SKU. Con Routes operativo, contrastar ida/regreso aproximado, descarga por cantidad, mínimo de una hora, redondeo, límites y carrito mixto. Sin datos completos debe seguir a cotizar; no equivale a envío gratuito. |
| Backend efectivo | `next.config.ts` puede enviar `/api/*` de Vercel hacia Render. El smoke ahora consulta el modo de pagos efectivo antes de crear datos. | Confirmar por configuración y registros qué servicio/versión recibe checkout y shipping, sus variables, callbacks y build con pnpm. Una respuesta de estado no prueba que todas las rutas o la base estén aisladas. |
| SEO | Auditoría previa de canonical, robots, sitemap y marcado; E2E local de no indexación y contenido. | Acceso a Search Console: propiedad, recepción del sitemap, cobertura, exclusiones e inspección de URLs. Validar imágenes por SKU, resultados enriquecidos y rendimiento móvil. La cantidad de URLs no acredita indexación. |
| Merchant Center | Auditoría previa: 122 productos recibidos, 121 en revisión y uno rechazado. Es una observación histórica, no un diagnóstico actualizado de la cuenta. | Abrir diagnóstico del SKU, corregir causa y verificar aprobación. Conciliar tarifa provisoria con logística horaria y contrastar feed/ficha/checkout en precio, disponibilidad, foto y devoluciones. Requiere acceso a la cuenta y decisiones comerciales. |

## Cambios ejecutables de este corte

- El smoke ya no espera un pedido exitoso con `WHATSAPP`: exige HTTP 422 y comprueba que no haya creado pedidos.
- Exige confirmación de operaciones mutantes también en localhost: un servidor local puede usar una base remota.
- Exige `PAYMENTS_ENV=test`, ausencia de confirmación productiva y estado remoto de Mercado Pago habilitado en test antes de crear usuarios/pedidos. Rechaza el dominio público productivo y redirects del preflight.
- Usa el token efectivo de Checkout Pro para desactivar preferencias QA; requiere su presencia antes de iniciar y exige redirect sandbox. Mantiene la limpieza limitada a datos QA pendientes, sin tickets ni pagos aprobados.
- El resultado declara `paymentReturnVerified: false`: crear una preferencia no verifica el pago ni su retorno.

## Ejecución autenticada pendiente

Preparar un servidor **y una base de datos aislados**, con el mismo código del commit a validar. Configurar las variables fuera de Git; no reutilizar credenciales productivas. Revisar también el destino de `API_PROXY_ORIGIN`, las reescrituras y los callbacks. No cambiar variables de producción para ejecutar QA.

Con credenciales de prueba disponibles y el servidor iniciado:

```bash
BASE_URL=http://127.0.0.1:3000 \
PAYMENTS_ENV=test PAYMENTS_PRODUCTION_CONFIRMED=false \
QA_CONFIRM_MUTATING_CHECKOUT=I_UNDERSTAND \
pnpm run test:checkout-flow
```

Para staging remoto se requiere además `ALLOW_REMOTE_CHECKOUT_QA=true` y HTTPS. El smoke crea y limpia usuario/pedidos pendientes y preferencias sandbox; no completa pagos. Si la limpieza detecta estados alterados, se detiene y reporta el error. El retorno de pago sigue necesitando la prueba sandbox específica descrita arriba.

## Datos logísticos: comprobación reproducible de solo lectura

La consulta cuenta metadatos numéricos entre 0 y 240 minutos y respeta la bandera de cotización manual. No modifica productos ni infiere tiempos a partir del nombre.

```sql
WITH logistics AS (
  SELECT active, specifications,
    CASE WHEN jsonb_typeof(specifications->'shipping_unload_minutes_per_unit') = 'number'
      THEN (specifications->>'shipping_unload_minutes_per_unit')::numeric
    END AS unload_minutes
  FROM public.products
)
SELECT count(*) FILTER (WHERE active) AS active_products,
  count(*) FILTER (
    WHERE active AND unload_minutes BETWEEN 0 AND 240
      AND (NOT (coalesce(specifications, '{}'::jsonb) ? 'shipping_requires_manual_quote')
        OR specifications->'shipping_requires_manual_quote' = 'false'::jsonb)
  ) AS active_with_valid_unload_metadata
FROM logistics;
```

## Publicación y evidencia

La PR sigue sin merge. El comentario del bot Vercel del 27/10 registra una **preview Ready**, por lo que no corresponde afirmar que nunca hubo despliegues de preview. El push puede generar otra preview automática; no se cambia infraestructura para evitarlo.

Después de una futura publicación autorizada, repetir smoke público de robots, sitemap, feed y fichas, e inspeccionar las URLs en Search Console. Esas comprobaciones posteriores no se dan por realizadas ahora.

Fuentes: [PR #47](https://github.com/DylanDev08/Materiales-FZAC/pull/47), [Quality Gate previo](https://github.com/DylanDev08/Materiales-FZAC/actions/runs/40497773888), [CodeQL previo](https://github.com/DylanDev08/Materiales-FZAC/actions/runs/40497773970), [E2E previo](https://github.com/DylanDev08/Materiales-FZAC/actions/runs/40497773991), [preview registrada](https://github.com/DylanDev08/Materiales-FZAC/pull/47#issuecomment-6440621646) y consulta agregada de solo lectura al proyecto FZAC-Ecommerce el 28/10/2026.
