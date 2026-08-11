import { JsonLd } from "@/components/seo/json-ld";
import { HomePage } from "@/components/home/home-page";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getPublicContact, getPublicSiteUrl, SITE_DESCRIPTION, SITE_NAME, SOCIAL_IMAGE, toAbsoluteUrl } from "@/lib/seo/site";

export const metadata = publicPageMetadata({
  title: "Materiales para construcción en Rosario",
  description: SITE_DESCRIPTION,
  path: "/"
});

export default function Page() {
  const siteUrl = getPublicSiteUrl();
  const contact = getPublicContact();
  const organization = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${siteUrl}/#store`,
    name: SITE_NAME,
    alternateName: "Fortaleza Construcciones",
    url: siteUrl,
    logo: toAbsoluteUrl("/logoFZAC.jpg"),
    image: toAbsoluteUrl(SOCIAL_IMAGE),
    description: SITE_DESCRIPTION,
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Rosario y alrededores, Santa Fe, Argentina"
    },
    ...(contact.email ? { email: contact.email } : {}),
    ...(contact.phone ? { telephone: contact.phone } : {}),
    ...(contact.instagram ? { sameAs: [contact.instagram] } : {})
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: SITE_NAME,
    publisher: { "@id": `${siteUrl}/#store` },
    inLanguage: "es-AR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/productos?search={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <JsonLd data={[organization, website]} />
      <HomePage />
    </>
  );
}
