import { HelpCenter } from "@/components/help/help-center";
import { getWhatsAppHref } from "@/lib/utils/contact";
import { getEnv } from "@/lib/utils/env";

export default async function Page({ searchParams }: { searchParams: Promise<{ tema?: string | string[] }> }) {
  const params = await searchParams;
  const initialTopic = Array.isArray(params.tema) ? params.tema[0] : params.tema;
  const email = getEnv("FZAC_EMAIL") || getEnv("NEXT_PUBLIC_FZAC_EMAIL") || "fortalezaconstruccionesrosario@gmail.com";
  const whatsappHref = getWhatsAppHref("Hola FZAC, el centro de ayuda me indicó que necesito atención humana.");

  return (
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
        </div>
      </section>
    </main>
  );
}
