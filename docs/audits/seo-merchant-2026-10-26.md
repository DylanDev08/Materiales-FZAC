# Auditoría SEO técnica — Materiales FZAC

Fecha: 26 de octubre de 2026. Alcance: e-commerce público `https://www.fzacmateriales.store` y código Next.js, sin acceso a Search Console ni a un informe de resultados orgánicos.

## Verificado públicamente

- La raíz `https://fzacmateriales.store/` redirige a `https://www.fzacmateriales.store/`, que es el host que figura en el sitemap y en los enlaces de Merchant Center.
- `/robots.txt` existe, permite rastreo de las páginas públicas, incluye la ruta al sitemap y bloquea administración, API, cuenta, carrito, login y checkout.
- `/sitemap.xml` respondió y mostraba **156 URL**, con raíz, productos, categorías, marcas, guías y legales. Esta cifra corresponde a la publicación actual al momento de la comprobación, no a los cambios de esta rama.
- Las páginas `/productos` y `/producto/cemento-portland-50kg` respondieron con títulos y metadescripciones propios, en español.
- Dominio canónico, Open Graph/Twitter y robots de metadatos están definidos en Next.js.
- Hay componentes de schema.org: `OnlineStore`, `WebSite`, `Product`, `Offer`, `BreadcrumbList`, `CollectionPage`, `ItemList`. Esto es **implementación en código**; no equivale a validar resultados enriquecidos desde Google.
- Hay páginas por categoría y marca, además de guías/calculadoras que pueden mejorar el enlazado interno.
- Merchant Center había recibido 122 productos: **121 en revisión, 1 no aprobado**. La causa del rechazo solo puede leerse en el diagnóstico de la cuenta.

## Correcciones preparadas en esta integración

1. `app/sitemap.ts` obtiene el catálogo real de Supabase mediante `getMerchantFeedProducts()`, sin publicar artículos demostrativos ante caídas de la base. El sitemap se genera bajo demanda y evita caché de una lista provisional construida sin la base.
2. `lib/seo/site.ts`: `SEO_INDEXING_ENABLED=true` **no** salta las restricciones de mantenimiento ni habilita indexación en previews de Vercel; `false` continúa desactivando SEO.
3. Actualizadas las descripciones de la portada y del catálogo para reflejar retiro/envío y compra coordinada sin presentar WhatsApp como única modalidad de pedido.
4. Los datos estructurados de `OnlineStore` describen los canales de pago como condicionados a disponibilidad en lugar de afirmar que solo se paga por WhatsApp.
5. `app/producto/[slug]/page.tsx`, integrado del PR #45: no expone `shipping_*` ni `internal_*` como propiedades públicas de los productos.
6. `/google-merchant.xml` conserva SKU, precios promocionales unitarios correctos, disponibilidad conservadora y límite de caché corto. **No** cambian las políticas publicadas en Merchant Center.

## Pendientes externos para SEO real y aprobación comercial

- **Search Console**: comprobar propiedad verificada, recepción exitosa del sitemap, cobertura/indexación, páginas excluidas, Core Web Vitals y búsquedas reales. Sin acceso al informe de Search Console no se puede afirmar que Google haya indexado las 156 URL.
- Revisar errores del único producto no aprobado desde Merchant Center, sin modificar todo el feed a ciegas.
- Comprobar varias fotografías con su producto exacto: el repositorio tiene imágenes de respaldo genéricas (incluidas fotografías de Unsplash). El hecho de que una URL de imagen sea válida no garantiza que represente fielmente el SKU.
- Merchant Center puede tener configurado provisionalmente 40.000 ARS de envío fijo; FZAC cobra por hora de transporte, mínimo una hora, incluyendo regreso y descarga variable. Ajustar política real antes de confiar en los anuncios/costos mostrados.
- Medir **rendimiento móvil/LCP/CLS** en condiciones reales; este examen de código no sustituye Lighthouse ni Search Console. Revisar peso de fotos, imágenes genéricas, textos duplicados de proveedores y descripciones cortas por SKU.
- Controlar que no existan URL obsoletas de productos y que no se publiquen páginas de marca vacías cuando cambie el stock.
- Tras el despliegue validado, repetir fetch de `robots.txt`, `sitemap.xml`, `/google-merchant.xml`, una ficha de producto y una página de marca/categoría. Comprobar SEO de vistas previas **sin indexar**.

## Estado del despliegue

Documento preparado dentro del PR #47. No está en la publicación de producción hasta que ese PR sea revisado, aprobado y desplegado. Que un test pase no sustituye las pruebas con el checkout, retorno de Mercado Pago, conexión Maps/Routes y valores reales de entrega.
