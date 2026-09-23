# Auditoría UX, QA y performance del panel admin

Fecha: 2026-09-23  
Rama: `codex/admin-qa-performance-20260923`  
Base: `origin/main` en `403b4ef575a6a2c7397ccf566005d8bdad320472`

## Alcance

Se revisaron las superficies compartidas y las rutas de Dashboard, Productos, Pedidos, Pagos, Eventos de pago, Inventario, Compras, Finanzas, Clientes, Categorías, Proveedores/Cuentas por pagar, Rentabilidad, Auditoría de precios, Sistema, Logs y Configuración. La validación autenticada se realizó con fixtures QA sin credenciales ni escrituras persistentes; el control anónimo se verificó contra la aplicación local de producción.

Quedaron expresamente fuera de esta rama autenticación, APIs de auth, rate limiting, middleware/proxy, cabeceras de Next, uploads, migraciones, MFA, RLS/policies, checkout, pagos, reservas de stock, Mercado Pago y variables de entorno.

## Problemas encontrados

- El enlace lateral “Notificaciones” apuntaba a un query string que el dashboard no consumía y duplicaba la campana funcional del encabezado.
- Las tablas compartidas dependían de scroll horizontal en teléfonos de 360–430 px.
- Productos y clientes conservaban tablas densas e incómodas en mobile.
- Productos cargaba toda la lista renderizada aunque el catálogo creciera.
- La desactivación de productos se ejecutaba desde un botón icon-only, sin confirmación intermedia.
- El dashboard duplicaba pagos rechazados y, cuando no había actividad, fabricaba un segmento visual con valor `1`.
- El bloque de estados sumaba métricas heterogéneas como si compartieran un único total porcentual.
- Faltaban en el centro de atención productos agotados y pagos rechazados ya provistos por el backend.
- Los filtros de fecha se mostraban incluso en tablas sin columna temporal.
- Los estados vacíos no distinguían entre una colección vacía y filtros sin resultados.
- El placeholder de búsqueda era genérico y mencionaba pedidos/clientes en tablas no relacionadas.
- El drawer de detalle no restauraba foco ni lo contenía durante navegación con teclado.
- La navegación lateral no exponía `aria-current` y no trasladaba/restauraba foco al abrir/cerrar en mobile.
- El botón que solo abre “Mantenimiento” financiero usaba estilo destructivo antes de llegar a la confirmación real.
- El loading principal era una tarjeta genérica y no reflejaba la geometría final del panel.
- Búsqueda y ordenamiento de clientes tenían labels accesibles incompletos.
- El gráfico del dashboard recalculaba los mismos puntos SVG por cada nodo.

## Mejoras realizadas

- Se eliminaron la navegación muerta y duplicada de notificaciones y se corrigieron nombres/acentos visibles.
- Se agregó `aria-current`, gestión de foco y cierre con `Escape` al menú mobile.
- Las tablas compartidas ahora se convierten en registros tipo card debajo de 720 px; tablet conserva scroll horizontal controlado.
- Las tablas de productos y clientes tienen presentación mobile con etiquetas, acciones grandes y texto sin cortes.
- Productos pagina 18 registros por vista y reinicia la página al cambiar búsqueda o filtros.
- Desactivar producto requiere una confirmación explícita en la fila; la llamada y contrato existentes no cambiaron.
- El dashboard usa solo métricas entregadas por backend, sin porcentajes ni valores ficticios.
- El centro de atención suma pagos rechazados y productos agotados, y mantiene pedidos, pagos, stock bajo, cuentas, chats y estado del sistema.
- Se extrajo lógica pura compartida para filtrar/paginar registros y construir alertas del dashboard.
- Los filtros de fecha aparecen solo cuando existe una columna temporal.
- Los estados vacíos explican si faltan registros o si los filtros no encontraron resultados y permiten limpiar la vista.
- El drawer de detalle mueve, contiene y restaura foco; sigue cerrando con `Escape` y backdrop.
- El acceso a mantenimiento financiero quedó neutral; la confirmación final continúa con semántica destructiva.
- El skeleton de carga replica sidebar, encabezado, métricas y tabla, incluye `aria-busy` y respeta `prefers-reduced-motion`.
- Se evitó recalcular la misma serie SVG para cada punto del gráfico.

## Testing agregado

- `tests/unit/admin-ui.test.mjs`
  - búsqueda combinada con estado;
  - filtro por rango de fechas;
  - paginación y páginas fuera de rango;
  - alertas reales de pedidos, pagos, bajo stock y sin stock;
  - alerta de configuración solo cuando el estado real no está listo.
- `tests/e2e/admin-responsive.spec.ts`
  - 360, 390, 430 y 768 px sin overflow;
  - cambio de tablas compartidas, productos y clientes a cards en mobile;
  - targets táctiles de acciones;
  - estado vacío recuperable;
  - rechazo anónimo de Dashboard, Productos, Pedidos, Pagos y Eventos de pago.

## Resultados locales

- `pnpm typecheck`: OK.
- `pnpm lint`: OK.
- `pnpm test`: OK, 18/18.
- `pnpm security:check`: OK; secrets/package manager y 39 tablas públicas con FORCE RLS.
- `pnpm build`: OK; 76 páginas estáticas generadas y rutas admin compiladas.
- Playwright `admin-responsive.spec.ts`: OK, 6/6.
- Playwright mobile, admin anónimo: OK, 4/4 mobile; 1 desktop omitido por diseño de la suite.
- Playwright security, APIs admin + rentabilidad anónima: OK, 2/2.
- Verificación de navegador a 390 px: redirección a login correcta, `scrollWidth = innerWidth = 390`, sin errores de página.

Advertencia del entorno local: Node `22.17.0` es menor al mínimo declarado por el repositorio (`22.22.0`). La instalación y todos los checks anteriores finalizaron correctamente, pero CI/producción deben continuar usando una versión compatible con `package.json`.

## Riesgos y decisiones de no intervención

- No se probaron mutaciones autenticadas con un usuario real; se usaron fixtures QA y controles anónimos para evitar datos permanentes.
- No se ejecutó `test:mobile-admin` porque el script existente crea y limpia datos en Supabase real.
- No se modificaron consultas, contratos de API ni reglas de negocio.
- No se tocaron SQL, índices, migraciones, Supabase, RLS ni configuración de producción.
- Las vistas especializadas de Compras, Inventario, Proveedores, Rentabilidad y Calidad IA ya tenían layouts responsivos dedicados; se conservaron para evitar un refactor amplio sin beneficio probado.
