import { publicPageMetadata } from "@/lib/seo/metadata";
import { getStoreLegalIdentity } from "@/lib/legal/store-identity";

export const metadata = publicPageMetadata({
  title: "Envío y retiro de materiales de construcción en Rosario",
  description: "Coordiná envío o retiro de materiales de construcción en Rosario con Materiales FZAC. Armá el pedido online y confirmá logística por WhatsApp.",
  path: "/envios-y-retiros"
});

export default function Page() {
  const identity = getStoreLegalIdentity();
  return (
    <main className="page-section legal-page">
      <div className="container">
        <span className="kicker">Logística</span>
        <h1>Envíos y retiro de materiales en Rosario</h1>
        <section>
          <p>
            FZAC permite retiro coordinado en <strong>{identity.address}</strong> y envío a domicilio en Rosario y alrededores.
            El cliente carga la dirección al generar el pedido y el equipo confirma disponibilidad, costo de envío y condiciones por WhatsApp.
          </p>
          <p>
            Para pedidos especiales, cargas voluminosas o cuando la web no pueda cotizar automáticamente el traslado,
            el pedido se genera igual y el envío se cotiza por WhatsApp antes de confirmar el pago.
          </p>
        </section>
      </div>
    </main>
  );
}
