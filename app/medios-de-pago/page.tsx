import { Banknote, CreditCard, ShieldCheck } from "lucide-react";

const methods = [
  {
    title: "Mercado Pago",
    text: "Tarjetas, dinero en cuenta y medios habilitados por el proveedor. FZAC no guarda datos de tarjetas.",
    icon: CreditCard
  },
  {
    title: "Transferencia bancaria",
    text: "La compra queda pendiente hasta que administracion valide el comprobante desde el panel.",
    icon: Banknote
  },
  {
    title: "Validacion segura",
    text: "El stock se descuenta y el ticket se confirma solo cuando el proveedor aprueba el pago.",
    icon: ShieldCheck
  }
];

export default function Page() {
  return (
    <main className="page-section payment-page">
      <div className="container">
        <span className="kicker">Pagos y transferencia</span>
        <h1>Medios de pago FZAC</h1>
        <p className="payment-page__lead">
          La tienda esta preparada para operar con Mercado Pago y transferencia coordinada. Los pagos se validan fuera
          del frontend para evitar aprobaciones falsas, descuentos duplicados de stock o tickets incorrectos.
        </p>

        <section className="payment-method-grid">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <article className="payment-method-card" key={method.title}>
                <Icon size={28} />
                <h2>{method.title}</h2>
                <p>{method.text}</p>
              </article>
            );
          })}
        </section>

        <section className="payment-transfer-panel">
          <div>
            <span className="kicker">Transferencia</span>
            <h2>Como se acredita una compra por transferencia</h2>
            <p>
              El cliente crea el pedido, adjunta o informa el comprobante por los canales de contacto y el administrador
              valida el pago antes de cambiar el estado operativo de la orden.
            </p>
          </div>
          <div className="payment-transfer-panel__steps">
            <span>1. Pedido pendiente</span>
            <span>2. Revision admin</span>
            <span>3. Pago aprobado</span>
            <span>4. Stock y ticket</span>
          </div>
        </section>
      </div>
    </main>
  );
}
