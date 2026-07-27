import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductDetail } from "@/components/product/product-detail";
import { getProductBySlug, getRelatedProducts } from "@/lib/db/catalog";
import { getPublicSiteUrl, SITE_NAME, toAbsoluteUrl } from "@/lib/seo/site";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

function productDescription(name: string, description: string) {
  const value = description.trim() || `${name} disponible en Materiales FZAC.`;
  return value.length > 160 ? `${value.slice(0, 157).trimEnd()}...` : value;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Producto no encontrado",
      robots: { index: false, follow: false }
    };
  }

  const canonical = `/producto/${product.slug}`;
  const description = productDescription(product.name, product.description);

  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: `${product.name} | ${SITE_NAME}`,
      description,
      url: canonical,
      images: [
        {
          url: toAbsoluteUrl(product.image_url),
          alt: product.name
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | ${SITE_NAME}`,
      description,
      images: [toAbsoluteUrl(product.image_url)]
    }
  };
}

export default async function Page({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);
  const siteUrl = getPublicSiteUrl();
  const productUrl = `${siteUrl}/producto/${encodeURIComponent(product.slug)}`;
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    description: productDescription(product.name, product.description),
    image: [toAbsoluteUrl(product.image_url), ...product.gallery.map(toAbsoluteUrl)],
    sku: product.sku,
    category: product.category?.name ?? product.subcategory,
    brand: {
      "@type": "Brand",
      name: product.brand
    },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "ARS",
      price: product.price,
      itemCondition: "https://schema.org/NewCondition",
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: {
        "@id": `${siteUrl}/#store`
      }
    },
    additionalProperty: Object.entries(product.specifications).map(([name, value]) => ({
      "@type": "PropertyValue",
      name,
      value: String(value)
    }))
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Productos",
        item: `${siteUrl}/productos`
      },
      ...(product.category?.slug
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: product.category.name,
              item: `${siteUrl}/categoria/${encodeURIComponent(product.category.slug)}`
            }
          ]
        : []),
      {
        "@type": "ListItem",
        position: product.category?.slug ? 3 : 2,
        name: product.name,
        item: productUrl
      }
    ]
  };

  return (
    <>
      <JsonLd data={[productSchema, breadcrumbSchema]} />
      <ProductDetail product={product} related={related} />
    </>
  );
}
