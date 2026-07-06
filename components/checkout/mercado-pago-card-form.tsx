"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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

type CardFormData = {
  token?: string;
  paymentMethodId?: string;
  payment_method_id?: string;
  issuerId?: string;
  issuer_id?: string;
  installments?: string | number;
  identificationType?: string;
  identification_type?: string;
  identificationNumber?: string;
  identification_number?: string;
  cardholderEmail?: string;
  cardholder_email?: string;
};

type CardFormInstance = {
  getCardFormData: () => CardFormData;
  unmount?: () => void;
};

type MercadoPagoInstance = {
  cardForm: (settings: Record<string, unknown>) => CardFormInstance;
};

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: Record<string, unknown>) => MercadoPagoInstance;
  }
}

let sdkPromise: Promise<void> | null = null;

function loadMercadoPagoSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("SDK no disponible en servidor."));
  if (window.MercadoPago) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No pudimos cargar el formulario seguro de Mercado Pago."));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

function readCardPayload(data: CardFormData): MercadoPagoCardPayload {
  return {
    token: String(data.token ?? ""),
    payment_method_id: String(data.paymentMethodId ?? data.payment_method_id ?? ""),
    issuer_id: data.issuerId || data.issuer_id ? String(data.issuerId ?? data.issuer_id) : undefined,
    installments: Number(data.installments ?? 1),
    identification_type: String(data.identificationType ?? data.identification_type ?? ""),
    identification_number: String(data.identificationNumber ?? data.identification_number ?? ""),
    cardholder_email: String(data.cardholderEmail ?? data.cardholder_email ?? "")
  };
}

export function MercadoPagoCardForm({
  amount,
  customerEmail,
  disabled,
  onSubmit
}: {
  amount: number;
  customerEmail: string;
  disabled: boolean;
  onSubmit: (payload: MercadoPagoCardPayload) => void;
}) {
  const formRef = useRef<CardFormInstance | null>(null);
  const submitRef = useRef(onSubmit);
  const disabledRef = useRef(disabled);
  const [ready, setReady] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || "";
  const publicKeyError = publicKey ? "" : "Falta configurar la public key de Mercado Pago para activar tarjeta.";
  const visibleError = publicKeyError || error;

  useEffect(() => {
    submitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    if (!publicKey) return;

    let mounted = true;

    loadMercadoPagoSdk()
      .then(() => {
        if (!mounted || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "es-AR" });
        formRef.current = mp.cardForm({
          amount: amount.toFixed(2),
          iframe: true,
          form: {
            id: "fzac-card-form",
            cardNumber: { id: "fzac-card-number", placeholder: "Numero de tarjeta" },
            expirationDate: { id: "fzac-card-expiration", placeholder: "MM/AA" },
            securityCode: { id: "fzac-card-security", placeholder: "CVV" },
            cardholderName: { id: "fzac-cardholder-name", placeholder: "Nombre y apellido" },
            issuer: { id: "fzac-card-issuer", placeholder: "Banco emisor" },
            installments: { id: "fzac-card-installments", placeholder: "Cuotas" },
            identificationType: { id: "fzac-identification-type", placeholder: "Tipo" },
            identificationNumber: { id: "fzac-identification-number", placeholder: "DNI/CUIT" },
            cardholderEmail: { id: "fzac-cardholder-email", placeholder: "Email" }
          },
          callbacks: {
            onFormMounted: (formError: unknown) => {
              if (!mounted) return;
              setReady(!formError);
              if (formError) setError("No pudimos montar el formulario seguro de tarjeta.");
            },
            onSubmit: (event: Event) => {
              event.preventDefault();
              if (disabledRef.current) return;
              const payload = readCardPayload(formRef.current?.getCardFormData() ?? {});
              submitRef.current(payload);
            },
            onFetching: () => {
              if (!mounted) return () => undefined;
              setFetching(true);
              return () => {
                if (mounted) setFetching(false);
              };
            }
          }
        });
      })
      .catch((sdkError: unknown) => {
        if (!mounted) return;
        setError(sdkError instanceof Error ? sdkError.message : "No pudimos cargar el formulario de tarjeta.");
      });

    return () => {
      mounted = false;
      formRef.current?.unmount?.();
      formRef.current = null;
    };
  }, [amount, publicKey]);

  return (
    <section className="card-payment-panel" aria-label="Pago con tarjeta">
      <div className="card-payment-panel__head">
        <div>
          <span className="kicker">Tarjeta de debito o credito</span>
          <h3>Pagar con tarjeta</h3>
        </div>
        <strong>{currency(amount)}</strong>
      </div>

      {visibleError ? <p className="notice notice--danger">{visibleError}</p> : null}
      {!visibleError && !ready ? <p className="notice">Cargando formulario seguro de Mercado Pago...</p> : null}

      <div className="payment-note">
        <p>
          Los campos de tarjeta se tokenizan con Mercado Pago. FZAC no recibe ni almacena numero de tarjeta, CVV ni datos
          sensibles del medio de pago.
        </p>
      </div>

      <form className="card-form-grid" id="fzac-card-form">
        <label>
          Numero de tarjeta
          <div className="secure-card-field" id="fzac-card-number" />
        </label>
        <label>
          Vencimiento
          <div className="secure-card-field" id="fzac-card-expiration" />
        </label>
        <label>
          CVV
          <div className="secure-card-field" id="fzac-card-security" />
        </label>
        <label>
          Nombre y apellido
          <input id="fzac-cardholder-name" type="text" autoComplete="cc-name" />
        </label>
        <label>
          Email
          <input id="fzac-cardholder-email" type="email" defaultValue={customerEmail} autoComplete="email" />
        </label>
        <label>
          Tipo de documento
          <select id="fzac-identification-type" />
        </label>
        <label>
          DNI / CUIT
          <input id="fzac-identification-number" type="text" inputMode="numeric" />
        </label>
        <label>
          Banco emisor
          <select id="fzac-card-issuer" />
        </label>
        <label>
          Cuotas
          <select id="fzac-card-installments" />
        </label>
        <button className="btn card-payment-panel__submit" type="submit" disabled={disabled || !ready || fetching}>
          {disabled || fetching ? <Loader2 size={18} /> : null}
          {fetching ? "Validando tarjeta..." : "Pagar con tarjeta"}
        </button>
      </form>
    </section>
  );
}
