"use client";

import Image from "next/image";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";

export type CheckoutLoadingPhase =
  | "validating"
  | "shipping"
  | "creating"
  | "preparing"
  | "redirecting"
  | "confirming"
  | "error";

export type CheckoutPaymentMode = "MERCADOPAGO" | "BANK_TRANSFER" | "WHATSAPP";

const phaseIndex: Record<CheckoutLoadingPhase, number> = {
  validating: 0,
  shipping: 1,
  creating: 2,
  preparing: 3,
  redirecting: 4,
  confirming: 4,
  error: 4
};

function methodCopy(method: CheckoutPaymentMode) {
  if (method === "BANK_TRANSFER") {
    return {
      title: "Preparando tu pedido",
      subtitle: "Estamos generando tu pedido por transferencia para que FZAC revise stock, total y datos de contacto.",
      lastStep: "Confirmando pedido"
    };
  }

  if (method === "WHATSAPP") {
    return {
      title: "Preparando tu pedido",
      subtitle: "Estamos preparando tu pedido para coordinar con FZAC.",
      lastStep: "Confirmando pedido"
    };
  }

  return {
    title: "Preparando tu compra",
    subtitle: "Estamos preparando tu pago seguro con Mercado Pago.",
    lastStep: "Redirigiendo"
  };
}

export function CheckoutLoadingScreen({
  method,
  phase,
  errorMessage
}: {
  method: CheckoutPaymentMode;
  phase: CheckoutLoadingPhase;
  errorMessage?: string;
}) {
  const copy = methodCopy(method);
  const activeIndex = phaseIndex[phase];
  const steps = ["Validando stock", "Calculando total", "Creando pedido", "Preparando pago", copy.lastStep];
  const isError = phase === "error";

  return (
    <div className="checkout-loading-screen" role="status" aria-live="polite" aria-label="Preparando checkout">
      <section className="checkout-loading-card">
        <div className="checkout-loading-logo">
          <Image src="/logoFZAC.jpg" alt="FZAC" width={72} height={72} priority />
        </div>
        <span className="kicker">Checkout FZAC</span>
        <h2>{isError ? "Necesitamos revisar el checkout" : copy.title}</h2>
        <p>{isError ? errorMessage ?? "No pudimos completar esta accion. Revisa el mensaje del checkout." : copy.subtitle}</p>

        <div className="checkout-loading-progress" aria-hidden="true">
          <span style={{ width: `${isError ? 100 : ((activeIndex + 1) / steps.length) * 100}%` }} />
        </div>

        <ol className="checkout-loading-steps">
          {steps.map((step, index) => {
            const status = isError && index === activeIndex ? "error" : index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
            return (
              <li className={`checkout-loading-step checkout-loading-step--${status}`} key={step}>
                {status === "done" ? <CheckCircle2 size={18} /> : status === "error" ? <XCircle size={18} /> : status === "active" ? <Loader2 size={18} /> : <ShieldCheck size={18} />}
                <span>{step}</span>
              </li>
            );
          })}
        </ol>

        {!isError ? (
          <small>No cierres esta ventana. Estamos validando stock y datos del pedido.</small>
        ) : null}
      </section>
    </div>
  );
}
