import { HelpCenter } from "@/components/help/help-center";
import { JsonLd } from "@/components/seo/json-ld";
import { getStoreLegalIdentity } from "@/lib/legal/store-identity";
import { getPublicSiteUrl } from "@/lib/seo/site";
import { getWhatsAppHref } from "@/lib/utils/contact";
import { getEnv } from "@/lib/utils/env";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Contacto Materiales FZAC en Rosario",
  description: "Contactá a Materiales FZAC en Rosario por WhatsApp o email para consultar materiales, stock, precios, retiro, envío y pedidos.",
  path: "/contacto"
});

export default async function Page({ searchParams }: { searchParams: Promise<{ tema?: string | string[] }> }) {
  const params = await searchParams;
  const initialTopic = Array.isArray(params.tema) ? params.tema[0] : params.tema;
  const identity = getStoreLegalIdentity();
  const siteUrl = getPublicSiteUrl();
  const email = getEnv("FZAC_EMAIL") || getEnv("NEXT_PUBLIC_FZAC_EMAIL") || identity.email;
  const whatsappHref = getWhatsAppHref("Hola FZAC, el centro de ayuda me indicó que necesito atención humana.");
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${siteUrl}/contacto#contact`,
    url: `${siteUrl}/contacto`,
    name: "Contacto Materiales FZAC",
    about: { "@id": `${siteUrl}/#store` },
    mainEntity: { "@id": `${siteUrl}/#store` }
  };

  return (
    <>
      <JsonLd data={contactSchema} />
      <main className="help-page help-page--contact">
      <section className="help-page__hero">
        <div className="container help-page__hero-inner">
          <div>
            <span className="kicker">Centro de ayuda FZAC</span>
            <h1>Resolvé tu consulta y seguí comprando</h1>
            <p>Elegí el tema. El asistente usa el catálogo y las reglas de la tienda para guiarte antes de derivar el caso.</p>
          </div>
        </div>
      </section>
      <section className="page-section">
        <div className="container">
          <HelpCenter whatsappHref={whatsappHref} email={email} initialTopic={initialTopic} />
          <section className="catalog-seo-copy" aria-label="Datos de contacto Materiales FZAC">
            <span className="kicker">Materiales FZAC · Rosario</span>
            <h2>Contacto y retiro en Rosario</h2>
            <div className="catalog-seo-copy__body">
              <p><strong>Dirección:</strong> {identity.address}</p>
              <p><strong>WhatsApp:</strong> {identity.phone}</p>
              <p><strong>Email:</strong> {email}</p>
              <p>Consultá stock, precios, cantidades, retiro o envío antes de cerrar el pedido. La compra se coordina directamente con FZAC por WhatsApp.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
    </>
  );
}
