import type { Metadata } from "next";
import Link from "next/link";
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

function schemaBrand(value?: string | null) {
  const brand = String(value ?? "").trim();
  if (!brand || /^sin marca( informada)?$/i.test(brand) || /^gen[eé]rico$/i.test(brand)) return null;
  return brand;
}

function schemaAvailability(product: { stock: number; availability_status?: string | null }) {
  if (product.availability_status === "CONSULT") return "https://schema.org/OutOfStock";
  if (product.availability_status === "IN_STOCK" && product.stock > 0) return "https://schema.org/InStock";
  return "https://schema.org/OutOfStock";
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
  const baseDescription = productDescription(product.name, product.description);
  const description = baseDescription.toLowerCase().includes("rosario")
    ? baseDescription
    : `${baseDescription.replace(/[.\s]+$/, "")}. Consultá precio y disponibilidad en Materiales FZAC, Rosario.`.slice(0, 160);

  return {
    title: `${product.name} en Rosario`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title: `${product.name} en Rosario | ${SITE_NAME}`,
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
      title: `${product.name} en Rosario | ${SITE_NAME}`,
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
  const description = productDescription(product.name, product.description);
  const siteUrl = getPublicSiteUrl();
  const productUrl = `${siteUrl}/producto/${encodeURIComponent(product.slug)}`;
  const brand = schemaBrand(product.brand);
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    url: productUrl,
    description,
    image: [toAbsoluteUrl(product.image_url), ...product.gallery.map(toAbsoluteUrl)],
    sku: product.sku,
    category: product.category?.name ?? product.subcategory,
    ...(brand ? {
      brand: {
        "@type": "Brand",
        name: brand
      }
    } : {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "ARS",
      price: product.price,
      itemCondition: "https://schema.org/NewCondition",
      availability: schemaAvailability(product),
      seller: {
        "@id": `${siteUrl}/#store`
      }
    },
    // Merchant structured data should describe the merchandise, not internal
    // delivery quoting flags or warehouse handling metrics.
    additionalProperty: Object.entries(product.specifications)
      .filter(([name]) => !/^(shipping_|internal_)/i.test(name))
      .map(([name, value]) => ({
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

  const categorySlug = product.category?.slug ?? "";
  const helpfulLinks =
    categorySlug === "construccion-en-seco"
      ? [
          { href: "/guias/materiales-pared-durlock", label: "Qué materiales necesito para una pared de Durlock" },
          { href: "/guias/placa-durlock-estandar-verde-roja", label: "Diferencias entre placas Durlock" },
          { href: "/calculadoras/placas-durlock", label: "Calculadora de placas Durlock" }
        ]
      : categorySlug === "pintura-impermeabilizacion"
        ? [
            { href: "/guias/membrana-liquida-para-techo", label: "Guía de membrana líquida para techo" },
            { href: "/calculadoras/membrana-liquida", label: "Calculadora de membrana líquida" },
            { href: "/calculadoras/pintura", label: "Calculadora de pintura" }
          ]
        : categorySlug === "steel-framing"
          ? [
              { href: "/guias/materiales-steel-framing", label: "Qué materiales se usan en Steel Framing" },
              { href: "/categoria/steel-framing", label: "Ver materiales para Steel Framing" }
            ]
          : [];

  return (
    <>
      <JsonLd data={[productSchema, breadcrumbSchema]} />
      <ProductDetail product={product} related={related} />
      {helpfulLinks.length ? (
        <section className="page-section" aria-label="Guías y herramientas relacionadas">
          <div className="container">
            <div className="catalog-seo-copy">
              <span className="kicker">También te puede servir</span>
              <h2>Guías y calculadoras relacionadas</h2>
              <div className="catalog-seo-copy__highlights">
                {helpfulLinks.map((item) => (
                  <Link key={item.href} href={item.href}>{item.label}</Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
