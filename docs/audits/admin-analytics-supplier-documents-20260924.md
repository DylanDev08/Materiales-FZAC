# Auditoría: Analytics, proveedores y reportes administrativos

Fecha: 2026-09-24  
Rama: `codex/vercel-analytics-supplier-docs-20260924`  
Base auditada: `origin/main` en `bd6838f41d864366563b7a1e66b1900a1343cbc2`

## Alcance y criterio de seguridad

- Se instrumentó Vercel Web Analytics sin incorporar tokens ni credenciales al código.
- Los datos detallados de tráfico permanecen en el workspace privado de Vercel. El admin ofrece estado y accesos directos, no métricas simuladas.
- Las listas de proveedores se guardan en un bucket privado y solo se descargan mediante una URL firmada de 60 segundos.
- Los precios proveedor, costos y márgenes se muestran únicamente en rutas administrativas protegidas.
- El stock indicado por un proveedor es una referencia externa y nunca modifica el inventario vendible de FZAC.
- No se modificaron productos, precios, pedidos, pagos ni stock durante esta tarea.
- Los fixtures QA se crean con identificadores aislados y se eliminan en `finally`. La verificación final encontró cero residuos.

## Cambios implementados

### Vercel Analytics

- Dependencia `@vercel/analytics` fijada en `2.0.1`.
- Componente `<Analytics />` instalado en el layout raíz. El admin lo presenta como instrumentación instalada; la recepción efectiva de eventos se confirma en el panel oficial de Vercel.
- Nueva ruta administrativa `Analíticas` con entorno, SHA de despliegue y enlaces al panel oficial de Analytics y despliegues.
- El panel aclara que el detalle permanece en Vercel para evitar exponer credenciales o inventar cifras.

### Proveedores y documentos privados

- Directorio mobile-first con logo circular, sitio, catálogo, contacto, cantidad de productos y documentos.
- Formularios de proveedor ampliados con `website_url`, `logo_url` y `catalog_url`, todos opcionales y restringidos a HTTPS.
- Se copiaron a Storage propio y se vincularon los logos públicos oficiales de Yesera Rosarina y Universo Pinturas, con autorización comercial indicada por el propietario.
- Se incorporaron sitio y catálogo oficiales de Yesera Rosarina y Universo Pinturas. No se inventaron datos faltantes de Urbe SRL o Maquinaria Sorrentos.
- La carga de PDF/CSV/XLS/XLSX valida origen, rol admin + MFA, tipo, firma/contenido, tamaño máximo de 10 MB y proveedor existente.
- Los archivos viven en el bucket privado `supplier-documents`; no hay URLs públicas permanentes.
- Cada documento admite filas verificadas manualmente para comparar precio proveedor con el precio FZAC vigente. Se guarda un snapshot del precio cliente para trazabilidad y el servidor rechaza vínculos con productos de otro proveedor.
- Las cargas, comparaciones y altas/ediciones de proveedor exigen registro en `admin_audit_logs`; si la auditoría falla, la operación se revierte.

### Reportes PDF

- Nueva ruta `Reportes PDF` con filtros por proveedor, categoría, disponibilidad y producto/SKU.
- Reporte para clientes: material, categoría, precio FZAC, unidad y disponibilidad. Nunca incluye costo, proveedor ni margen.
- Reporte interno: agrega proveedor, costo registrado, ganancia bruta por unidad y markup.
- Salida A4 landscape, logo circular, filas no fragmentadas y componentes flotantes/navegación ocultos al imprimir.
- La disponibilidad `CONSULT` se imprime como “Consultar disponibilidad”; no se convierte en stock ficticio.

### Robustez y mantenimiento

- El generador de tipos de Supabase escribe `types/supabase.ts` solo si el CLI finaliza correctamente y devuelve una definición válida. Esto evita truncar el archivo ante un fallo de red o autenticación.
- El auditor de Yesera se alineó con la política comercial vigente del repositorio: 10% hasta ARS 60.000 y 8% por encima. El cambio corrige el auditor; no modifica precios.
- El favicon/logo dinámico y los logos del panel usan recorte circular.
- La búsqueda privada por productos de proveedor se normaliza antes de construir el filtro PostgREST.

## Estado de datos

Verificación remota posterior a los cambios:

- Productos: 1.770 totales; 114 activos.
- Precios inválidos: 0.
- Stock negativo: 0.
- Productos con stock 0: 1.767.
- Productos `CONSULT`: 1.767.
- Yesera Rosarina: 111 productos vinculados; sitio, catálogo y logo cargados.
- Universo Pinturas SRL Rosario: 1.656 productos vinculados; sitio, catálogo y logo cargados.
- Urbe SRL: sin productos y sin datos públicos agregados.
- Maquinaria Sorrentos: sin productos y sin datos públicos agregados.
- Residuos QA: 0 perfiles, 0 proveedores, 0 productos, 0 órdenes y 0 documentos.

Auditoría Yesera:

- 111 productos.
- 0 duplicados exactos.
- 21 con margen 8% y 90 con margen 10%.
- 0 márgenes o precios inconsistentes.
- 0 stock distinto de cero.
- 0 estados distintos de `CONSULT`.
- 0 imágenes faltantes y 0 imágenes fuera del Storage FZAC.

Auditoría general:

- 2 imágenes históricas faltantes y 88 descripciones pobres continúan documentadas para revisión con fuente verificable.
- 3 productos históricos no tienen proveedor interno asignado. No se asignó uno sin evidencia.

## Supabase y seguridad

- Migración aplicada y reconciliada con el ledger remoto: `20260924152630_supplier_documents_and_profile.sql`.
- Migración aditiva aplicada y reconciliada con el ledger remoto: `20260924163646_supplier_documents_spreadsheet_formats.sql` para XLS/XLSX.
- Tablas nuevas: `supplier_documents` y `supplier_document_items`.
- Ambas tablas tienen RLS y FORCE RLS activos.
- Solo `authenticated` admin puede leer; las escrituras se realizan server-side tras verificar admin + MFA.
- Bucket `supplier-documents`: privado, 10 MB. Tras la migración aditiva admite PDF/CSV/XLS/XLSX.
- El security check local confirmó 36 tablas públicas con FORCE RLS.
- Las tres tablas cerradas sin policies (`_prisma_migrations`, `security_rate_limits`, `stock_reservations`) continúan cerradas intencionalmente.
- Pendiente manual: Supabase Auth mantiene desactivada **Leaked Password Protection**. Debe activarse en Dashboard > Authentication > Password Security. Referencia: <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>.
- Los avisos de índices sin uso y policies permisivas múltiples son recomendaciones de rendimiento históricas. No se eliminaron índices ni se reescribieron policies sin una ventana de observación y pruebas de carga.

## Validaciones ejecutadas

| Validación | Resultado |
| --- | --- |
| `corepack pnpm typecheck` | OK |
| `corepack pnpm lint` | OK, 0 errores y 0 warnings |
| `corepack pnpm test` | OK, 15/15 |
| `corepack pnpm security:check` | OK |
| `corepack pnpm build` | OK, 77 rutas |
| Playwright `security-routes.spec.ts` | OK, 24/24 |
| `corepack pnpm test:mobile-admin` | OK |
| `corepack pnpm audit:catalog` | OK con 6 hallazgos documentales |
| `corepack pnpm catalog:supplier-parity:audit` | OK, 1.767 filas de proveedor consistentes; 3 históricos sin proveedor |
| `corepack pnpm catalog:la-yesera:audit` | OK |
| `corepack pnpm qa:cleanup` | OK, 0 candidatos |

El smoke autenticado cubrió login, alta y verificación MFA, dashboard, navegación, finanzas, compras, inventario, cuentas de proveedor, directorio de proveedores, reportes y Analytics en 390 px y desktop. También validó idempotencia y ausencia de overflow horizontal o controles táctiles menores a 42 px.

## Correcciones posteriores a la revisión

Después del lote original se revisó el diff real en GitHub y se corrigieron cinco puntos adicionales:

- el archivo de migración base se reconcilió con el ledger remoto `20260924152630`, sin reejecutar el schema;
- se aplicó y versionó la migración aditiva `20260924163646_supplier_documents_spreadsheet_formats.sql`;
- PDF/CSV/XLS/XLSX usan MIME normalizado, extensión coherente y validación de firma/contenido;
- el servidor rechaza vincular un producto a un documento de un proveedor distinto;
- cargas, comparaciones, altas/ediciones de proveedores, envío y cancelación de órdenes revierten el cambio si no puede persistirse su auditoría;
- el panel de Analytics informa “instrumentación instalada” y remite a Vercel para confirmar recepción real de eventos.

Validación posterior a estas correcciones:

- Supabase confirma ambas migraciones en su ledger y el bucket privado admite PDF/CSV/XLS/XLSX.
- Security Advisor no agregó hallazgos nuevos; permanecen únicamente los avisos históricos documentados.
- Preview del proyecto Vercel canónico `materiales-fzac-391o` para el head corregido: `READY`.
- GitHub no reportó todavía ejecuciones de Quality Gate/CodeQL para el head corregido mediante la integración consultada; no se presentan como aprobadas hasta que existan.

## Plataforma

- Producción Vercel auditada antes del PR: deploy `dpl_HmHgJPtz5bUssQFdHS7bHWzpoGDT`, estado `READY`, SHA `bd6838f41d864366563b7a1e66b1900a1343cbc2`.
- Los dos errores agrupados de los últimos siete días pertenecen a un despliegue anterior y a una URL malformada `/productos%5C`; no corresponden a las nuevas rutas.
- El entorno local usa Node 22.17.0 y el repositorio solicita Node >=22.22.0. Los checks pasaron, pero CI/producción debe mantener la versión declarada.

## Pendientes controlados

1. Activar Leaked Password Protection manualmente en Supabase Auth.
2. Completar Urbe SRL y Maquinaria Sorrentos solo cuando existan fuentes oficiales verificables para web, logo y contacto.
3. Mejorar las 88 descripciones y 2 imágenes históricas únicamente con fuente o autorización confirmada.
4. Observar uso real antes de consolidar policies o retirar índices informados como no utilizados.
5. Confirmar recolección de Analytics después del primer deploy que incluya `@vercel/analytics` y después de visitar la preview/producción.
