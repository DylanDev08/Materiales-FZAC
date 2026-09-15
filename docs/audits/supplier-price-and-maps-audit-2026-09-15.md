# Auditoría de precios de proveedores y Google Maps

Fecha: 15 de septiembre de 2026
Proyecto Supabase: `FZAC-Ecommerce` (`gooxgjzetziwnxhuymmx`)

## Resultado ejecutivo

- La Yesera Rosarina: 111 productos vinculados revisados; 21 usan la regla de 10% y 90 la regla de 20%. La diferencia final de precio y margen es cero en todos.
- Universo Pinturas SRL Rosario: 1.656 productos vinculados revisados; todos conservan margen 0% y paridad exacta con la fuente autorizada.
- Universo se recorrió primero en preview. No se insertaron productos nuevos: 416 precios vinculados se sincronizaron y una novedad de categoría dudosa quedó en revisión, sin alta automática.
- La Yesera conserva `stock = 0` y `availability_status = CONSULT` en los 111 productos. No se inventó disponibilidad.
- Los archivos de preview con costos se conservaron localmente y se retiraron del seguimiento de Git para que no continúen exponiéndose en el repositorio.

## Cambios de catálogo

- Se reemplazó la regla histórica por el umbral final: origen mayor a 60.000 usa 10%; origen menor o igual a 60.000 usa 20%. El redondeo se aplica una sola vez.
- Se corrigió la paginación de lecturas Supabase: el límite efectivo de 1.000 filas ya no produce falsos productos nuevos.
- Se corrigió la normalización de nombres para no unir palabras que contienen la letra `x` (por ejemplo, “látex interior”).
- Se agregó clasificación `INCLUDE`/`REVIEW` al preview de Universo para impedir altas automáticas fuera del alcance comercial de pinturas y obra.
- Se creó una auditoría local JSON/Markdown con estados de paridad, faltantes y disponibilidad; sus salidas con costos están ignoradas por Git.

## Panel privado

La nueva sección **Admin > Auditoría de precios** incluye:

- diferencias de precio o margen;
- productos sin imagen, descripción, proveedor, URL o precio de origen;
- estado `CONSULT`;
- filtros por proveedor, estado y dato operativo;
- exportación CSV privada;
- acceso a la fuente y al editor de producto;
- recálculo protegido por rol admin, rate limit, validación de origen y control optimista del precio actual.

La ruta y su API bloquean sesiones anónimas. Los datos privados no se incluyen en el catálogo, el detalle público ni el asistente.

## Google Maps y envíos

- El frontend de Places/Autocomplete carga con la clave de navegador.
- El backend usa Routes API `computeRouteMatrix`, field mask acotado, timeout de 7 segundos, caché y deduplicación.
- La prueba real de Routes detectó que la clave server configurada es rechazada por una restricción de HTTP referrer incompatible con una llamada server-side.
- El backend ahora consulta distancia aunque la tarifa comercial no esté configurada, traduce fallos de Google a mensajes seguros y nunca devuelve la clave, el código técnico ni el proyecto de Google.
- El healthcheck admin separa tres estados: clave server presente, tarifa configurada y cotización lista.
- La tarifa sigue desactivada: no se configuraron importes inventados. Retiro continúa en $0 y delivery falla cerrado con opción de coordinación.

Acción externa pendiente: corregir en Google Cloud la restricción de la clave server y limitarla a Routes API. La sesión local de `gcloud` está vencida, por lo que no fue seguro modificar la credencial sin volver a autenticar la cuenta propietaria.

## Seguridad Supabase

- `product_supplier_sources` mantiene RLS forzado, lectura autenticada solo mediante `is_admin()` y escritura exclusiva con service role server-side.
- Los controles locales de secretos y FORCE RLS pasan.
- El asesor de seguridad conserva tres avisos previos: Leaked Password Protection desactivado; `public.is_admin()` ejecutable por `authenticated`; `_prisma_migrations` con RLS pero sin policy. No se abrió ninguna policy ni se bajó seguridad durante esta tarea.

## Calidad de datos pendiente

- 0 diferencias de precio.
- 0 diferencias de margen.
- 0 fuentes vinculadas sin precio de origen.
- 0 fuentes vinculadas sin URL.
- 2 productos generales sin imagen real.
- 112 filas del auditor privado sin descripción.
- 3 productos manuales sin proveedor, fuera de la corrección automática.

No se completaron imágenes, descripciones o proveedores sin una fuente verificable.

## Validaciones

- `pnpm run typecheck`: OK.
- `pnpm run lint`: OK.
- `pnpm run build`: OK; 76 páginas, incluida `/admin/auditoria-precios`.
- `pnpm run security:check`: OK.
- `pnpm run audit:catalog`: READY.
- `pnpm run catalog:la-yesera:audit`: OK; sin duplicados ni desvíos.
- `pnpm run catalog:supplier-parity:audit`: OK; 1.767 filas vinculadas en paridad.
- `pnpm test`: 12/12 OK.
- Playwright local: 182 pruebas aprobadas y 36 omitidas por configuración; catálogo, carrito CONSULT, checkout, admin anónimo, mobile, seguridad, chatbot y Maps validados. Los pases previos detectaron dos expectativas de espera/texto demasiado acotadas; se corrigieron y el pase completo final quedó verde.

El SHA y el deploy final se verifican después del push y se reportan en la entrega.
