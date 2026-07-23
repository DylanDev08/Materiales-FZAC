"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { currency } from "@/lib/formatters/currency";

export type MercadoPagoCardPayload = {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments: number;
  identification_type: string;
  identification_number: string;
  cardholder_email: string;
};

type CardPaymentSubmit = NonNullable<ComponentProps<typeof CardPayment>["onSubmit"]>;
type CardPaymentFormData = Parameters<CardPaymentSubmit>[0];
type CardPaymentCustomization = NonNullable<ComponentProps<typeof CardPayment>["customization"]>;

const cardBrickCustomization: CardPaymentCustomization = {
  paymentMethods: {
    minInstallments: 1,
    maxInstallments: 12,
    types: {
      included: ["credit_card", "debit_card", "prepaid_card"]
    }
  },
  visual: {
    style: {
      theme: "dark",
      customVariables: {
        baseColor: "#f4c400",
        baseColorFirstVariant: "#ffd31a",
        textPrimaryColor: "#ffffff",
        textSecondaryColor: "#b8b8b8",
        inputBackgroundColor: "#101010",
        formBackgroundColor: "#171717",
        outlinePrimaryColor: "rgba(244, 196, 0, 0.38)",
        outlineSecondaryColor: "rgba(255, 255, 255, 0.12)",
        buttonTextColor: "#0b0b0b",
        borderRadiusMedium: "8px",
        formPadding: "0px"
      }
    },
    texts: {
      formTitle: "Tarjeta de crédito o débito",
      formSubmit: "Pagar con tarjeta"
    }
  }
};

function cardPayload(data: CardPaymentFormData): MercadoPagoCardPayload {
  return {
    token: String(data.token ?? ""),
    payment_method_id: String(data.payment_method_id ?? ""),
    issuer_id: data.issuer_id ? String(data.issuer_id) : undefined,
    installments: Number(data.installments ?? 1),
    identification_type: String(data.payer?.identification?.type ?? ""),
    identification_number: String(data.payer?.identification?.number ?? ""),
    cardholder_email: String(data.payer?.email ?? "")
  };
}

export function MercadoPagoCardForm({
  amount,
  publicKey,
  customerEmail,
  disabled,
  onSubmit
}: {
  amount: number;
  publicKey: string;
  customerEmail: string;
  disabled: boolean;
  onSubmit: (payload: MercadoPagoCardPayload) => Promise<void> | void;
}) {
  const submitRef = useRef(onSubmit);
  const [sdkReady, setSdkReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    submitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    const normalizedPublicKey = publicKey.trim();
    if (!normalizedPublicKey) return;
    let active = true;

    try {
      initMercadoPago(normalizedPublicKey, {
        locale: "es-AR",
        advancedFraudPrevention: true
      });
      window.queueMicrotask(() => {
        if (!active) return;
        setSdkReady(true);
        setError("");
      });
    } catch {
      window.queueMicrotask(() => {
        if (active) setError("No pudimos iniciar el formulario seguro de Mercado Pago.");
      });
    }
    return () => {
      active = false;
    };
  }, [publicKey]);

  const initialization = useMemo(
    () => ({
      amount,
      payer: customerEmail ? { email: customerEmail } : undefined
    }),
    [amount, customerEmail]
  );

  const handleReady = useCallback(() => {
    setReady(true);
    setError("");
  }, []);

  const handleError = useCallback(() => {
    setReady(false);
    setError("No pudimos cargar el formulario seguro de Mercado Pago. Actualizá la página e intentá nuevamente.");
  }, []);

  const handleSubmit = useCallback<CardPaymentSubmit>(async (data) => {
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      await submitRef.current(cardPayload(data));
    } finally {
      setSubmitting(false);
    }
  }, [submitting]);

  const publicKeyError = publicKey.trim() ? "" : "Falta configurar la Public Key de Mercado Pago para habilitar tarjetas.";
  const visibleError = publicKeyError || error;

  return (
    <section className="card-payment-panel" aria-label="Pago seguro con tarjeta">
      <div className="card-payment-panel__head">
        <div>
          <span className="kicker">Procesado por Mercado Pago</span>
          <h3>Tarjeta online segura</h3>
        </div>
        <strong>{currency(amount)}</strong>
      </div>

      <div className="card-payment-panel__secure">
        <ShieldCheck size={19} />
        <p>
          Completá los datos en el Card Payment Brick oficial. FZAC no recibe ni almacena número de tarjeta, CVV ni
          vencimiento.
        </p>
      </div>

      {visibleError ? <p className="notice notice--danger">{visibleError}</p> : null}

      {!visibleError && disabled ? (
        <div className="card-payment-panel__lock">
          <LockKeyhole size={19} />
          <div>
            <strong>Formulario protegido</strong>
            <span>Aceptá los términos y verificá el pedido para habilitar el pago con tarjeta.</span>
          </div>
        </div>
      ) : null}

      {!visibleError && !disabled && sdkReady ? (
        <div className={`mp-card-brick ${ready ? "is-ready" : ""}`} aria-busy={!ready || submitting}>
          {!ready ? <div className="mp-card-brick__skeleton" aria-hidden="true"><span /><span /><span /><span /></div> : null}
          <CardPayment
            id="fzacCardPaymentBrick"
            locale="es-AR"
            initialization={initialization}
            customization={cardBrickCustomization}
            onReady={handleReady}
            onError={handleError}
            onSubmit={handleSubmit}
          />
        </div>
      ) : null}
    </section>
  );
}
