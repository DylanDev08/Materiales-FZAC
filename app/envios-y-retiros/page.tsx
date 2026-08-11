import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Envíos y retiro de materiales",
  description: "Conocé cómo coordinar envíos y retiro de materiales para construcción con Materiales FZAC en Rosario.",
  path: "/envios-y-retiros"
});

export default function Page() {
  return (
    <main className="page-section legal-page">
      <div className="container">
        <span className="kicker">Logística</span>
        <h1>Envíos y retiros</h1>
        <section>
          <p>
            FZAC permite retiro coordinado y envío a domicilio acordado por administración. El cliente carga la dirección
            completa en checkout y el equipo confirma disponibilidad, horario y condiciones por los canales de contacto.
          </p>
          <p>
            Para pedidos especiales, cargas voluminosas o dudas de entrega, se puede coordinar por WhatsApp antes de
            completar el pago.
          </p>
        </section>
      </div>
    </main>
  );
}
