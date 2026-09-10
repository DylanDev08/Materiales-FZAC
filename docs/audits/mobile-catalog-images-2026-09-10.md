# Ajuste catálogo mobile e imágenes

## Contexto

La carga de proveedores y productos quedó aplicada en Supabase FZAC-Ecommerce. Este seguimiento corrige el lado frontend para que el catálogo priorice imágenes reales cargadas por producto y no reemplace URLs válidas por placeholders genéricos.

## Cambios

- Se amplió el resolver de imágenes de productos para aceptar URLs HTTPS válidas desde Supabase Storage, Cloudinary, Tiendanube/MiTiendaNube y CloudFront.
- Se dejó de descartar cualquier URL que contenga `/products/` cuando viene desde un host externo válido.
- Se agregaron imágenes fallback por tipo de material para construcción en seco, perfiles, PVC, tornillos, masilla, aislación, placas cementicias, OSB, cemento, electricidad y plomería.
- Se agregaron refinamientos mobile para filtros, grilla, cards, textos largos, precios, badges y drawer de filtros.

## Nota sobre imágenes del proveedor

Si las imágenes de La Yesera Rosarina ya fueron guardadas en `products.image_url` o subidas a Supabase Storage, el frontend ahora las puede mostrar. Si solo existen como referencia interna, conviene pasarlas a Storage propio de FZAC antes de usarlas como imágenes definitivas.
