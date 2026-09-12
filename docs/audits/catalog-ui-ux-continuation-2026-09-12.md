# Continuación de catálogo y UX FZAC — 12/09/2026

## Resumen ejecutivo

Se auditó el proyecto `FZAC-Ecommerce` (`gooxgjzetziwnxhuymmx`), la categoría pública Construcción en Seco y las 144 publicaciones accesibles del catálogo general de La Yesera. Antes de escribir se generó una vista previa: 108 productos dentro del alcance, 106 vinculados a importaciones existentes, 2 altas, 0 duplicados y 0 casos ambiguos. La repetición posterior fue idempotente: 0 altas y 108 actualizaciones vinculadas.

## 1–5. Supabase, cantidades y proveedores

1. Supabase usado: `FZAC-Ecommerce`.
2. Project ref: `gooxgjzetziwnxhuymmx`.
3. Productos antes: 112.
4. Productos después: 114 activos. Hay 111 productos públicos vinculados a Yesera Rosarina.
5. Proveedores verificados en Admin: Yesera Rosarina, Urbe SRL y Maquinaria Sorrentos; no se inventaron datos comerciales.

## 6–9. Fuente, altas, actualizaciones y duplicados

6. Faltantes inequívocos encontrados fuera de la categoría directa pero dentro del catálogo público relacionado:
   - `LANA DE VIDRIO DURLOCK 14.5 X 1.20 50 MM` — [fuente](https://tienda.layeserarosarina.com.ar/productos/lana-de-vidrio-durlock-14-5-x-1-20-50-mm/).
   - `PGU 100-35 E 0,93 X 3 ML` — [fuente](https://tienda.layeserarosarina.com.ar/productos/pgu-100-35-e-093-x-3-ml/).
7. Insertados: 2.
8. Actualizados/refrescados desde la fuente: 106 en la primera aplicación; la segunda ejecución verificó 108 vinculaciones sin error.
9. Omitidos por duplicado: 0. Duplicados exactos finales por ID externo, SKU, slug y nombre normalizado: 0.

Los yesos y cantoneras tradicionales encontrados en el catálogo general no se importaron porque no son inequívocamente construcción en seco. No se inventó alcance ni se reclasificaron productos dudosos.

## 10–15. Precio, imagen, categoría y procedencia

10. Productos Yesera con +20%: 111. Las altas verificadas fueron ARS 135.000 → ARS 162.000 y ARS 10.950 → ARS 13.140.
11. Productos aro/aros con +10%: 0; no apareció ninguno entre las 144 publicaciones recorridas. La regla quedó implementada y probada para futuras importaciones.
12. Productos Yesera sin precio: 0.
13. Productos Yesera sin imagen: 0. Se subieron 2 WebP nuevos a `product-images/la-yesera-rosarina`; no hay hotlinks.
14. Categorías asignadas: Lana Durlock → `construccion-en-seco`; PGU 100 → `steel-framing`.
15. `product_supplier_sources`: 109 → 111 filas Yesera. Conserva precio original, URL, imagen fuente, margen y fecha de revisión en tabla privada. La restricción de margen admite solamente 10 o 20.

La auditoría final informa 0 márgenes inválidos, 0 stock distinto de cero, 0 disponibilidades distintas de `CONSULT`, 0 imágenes faltantes y 0 imágenes fuera del Storage FZAC.

## 16–19. UI/UX, mobile, filtros y producto

16. Home: accesos directos reales a Construcción en seco, placas, montantes y soleras, perfiles, tornillos y accesorios, masillas y cintas. Se preservó la identidad industrial FZAC y el foco de catálogo.
17. Mobile: se corrigió la prueba del loader reducido y se verificaron Home, catálogo, carrito, checkout, acceso, legales y Admin sin overflow en iPhone 13, Pixel 7 y viewports compactos de 360 px.
18. Filtros: se expuso `Stock disponible`; búsquedas compuestas de montantes/soleras y masillas/cintas consultan términos reales con OR, sin resultados ficticios.
19. Cards y detalle: conservan precio FZAC, unidad, disponibilidad y CTA de consulta. Los dos nuevos productos se sirven con imágenes propias. Los artículos `CONSULT` no muestran stock validado ni compra directa.

## 20–21. Checkout/backend y seguridad

20. El backend recalcula precios desde Supabase y ahora también rechaza explícitamente `CONSULT` y `OUT_OF_STOCK` mediante la misma regla comercial central, incluso si una fila quedara con stock positivo por inconsistencia. Retiro no cotiza envío; delivery falla cerrado si no existe distancia/tarifa real.
21. Correcciones: falso negativo del auditor causado por una variable `.env` con BOM; efectos React sincrónicos que rompían ESLint; contrato ARIA del buscador; validación backend de disponibilidad; Google OAuth queda deshabilitado y muestra preparación hasta que React haya hidratado el formulario, evitando clics perdidos en conexiones lentas. `security:check` y el control de 37 tablas con FORCE RLS pasan.

Advisors de Supabase pendientes, sin abrir políticas: protección de contraseñas filtradas deshabilitada en Auth; aviso sobre `is_admin()` SECURITY DEFINER (su ejecución por autenticados es parte del diseño de las policies y solo devuelve el rol efectivo); recomendaciones de índices/policies para rendimiento. Referencias: [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) y [database linter](https://supabase.com/docs/guides/database/database-linter).

## 22–23. Archivos y commit

22. Se modificaron importador/auditores de catálogo, datasets verificables, `lib/db/catalog.ts`, `lib/db/orders.ts`, Home, filtros, loader, buscador, tests unitarios/E2E y la migración de margen.
23. El SHA final se informa en la entrega y en el historial de `main`; un commit no puede contener de forma confiable su propio SHA.

## 24. Build y validaciones

- `pnpm run typecheck`: correcto.
- `pnpm run lint`: correcto.
- `pnpm run build`: correcto, 74 rutas.
- `pnpm run security:check`: correcto.
- `pnpm test`: 8/8 correctos.
- `pnpm run audit:catalog`: READY, 114 productos y 9 categorías.
- `pnpm run catalog:la-yesera:audit`: correcto, 111/111 filas consistentes.
- Advertencia no bloqueante local: Node 22.17.0; el repositorio exige 22.22.0 y Render usa la versión fijada.

## 25. Playwright y deploy

- Catálogo local sobre build productivo: 12/12 correctas.
- Matriz mobile: 66 correctas, 44 omitidas por depender de sesión autenticada o stock comprable, 0 fallos.
- El estado final de Render y el SHA servido se verifican después del push y se informan en la entrega.

## 26. Pendientes reales

- FZAC debe definir su fórmula comercial exacta de envío (base, precio por km, mínimo, redondeo y radio, o una tabla porcentual explícita). Las claves Google browser/server están configuradas, pero no se inventó una tarifa. Hasta entonces delivery falla cerrado y ofrece retiro/WhatsApp.
- Activar Leaked Password Protection desde la configuración de Supabase Auth.
- Completar descripciones comerciales autorizadas: 112 productos tienen descripción corta; no se inventó contenido.
- Dos productos históricos ajenos a esta importación siguen con placeholder/sin foto.
- Las pruebas USER/ADMIN y checkout mutante requieren cuentas QA controladas y stock real; no se fabricó stock para habilitarlas.
