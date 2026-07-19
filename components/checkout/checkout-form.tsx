"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Landmark,
  Loader2,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  UserRound
} from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { CheckoutLoadingScreen, type CheckoutLoadingPhase } from "@/components/checkout/checkout-loading-screen";
import { currency } from "@/lib/formatters/currency";
import { getWhatsAppHref } from "@/lib/utils/contact";
import type { SessionProfile } from "@/lib/auth/get-user";
import type { ShippingMethod } from "@/types/domain";

type CheckoutStep = "customer" | "delivery" | "review" | "payment";
type PaymentMode = "MERCADOPAGO" | "BANK_TRANSFER" | "WHATSAPP";
type CheckoutProcessPhase = CheckoutLoadingPhase | "idle";
type CartItems = ReturnType<typeof useCart>["items"];

type StockIssue = {
  productId: string;
  requested: number;
  available: number;
  name?: string;
};

type StockState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok" }
  | { status: "error"; message: string; items: StockIssue[] };

type ShippingQuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; amount: number; distanceKm: number; durationText?: string }
  | { status: "error"; message: string; distanceKm?: number };

const checkoutSteps: Array<{ id: CheckoutStep; label: string }> = [
  { id: "customer", label: "1. Comprador" },
  { id: "delivery", label: "2. Entrega" },
  { id: "review", label: "3. Revision" },
  { id: "payment", label: "4. Pago" }
];

function checkoutItems(items: ReturnType<typeof useCart>["items"]) {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity
  }));
}

const CHECKOUT_IDEMPOTENCY_STORAGE_KEY = "fzac.checkout.intent.v1";

type CheckoutIntentSnapshot = {
  fingerprint: string;
  paymentMode: PaymentMode;
  key: string;
  createdAt: number;
};

function createCheckoutIntentId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `fzac-checkout-${random}`;
}

function checkoutCartFingerprint(items: CartItems) {
  return items
    .map((item) => `${item.productId}:${item.quantity}`)
    .sort()
    .join("|");
}

function readCheckoutIntentSnapshot(): CheckoutIntentSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as CheckoutIntentSnapshot;
    if (!parsed?.key || !parsed.fingerprint || !parsed.paymentMode) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCheckoutIntentSnapshot(snapshot: CheckoutIntentSnapshot) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY, JSON.stringify(snapshot));
}

function clearCheckoutIntentSnapshot() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
}

export function CheckoutForm({
  paymentsTestMode = false,
  profile
}: {
  paymentsTestMode?: boolean;
  profile: SessionProfile | null;
}) {
  const router = useRouter();
  const { hydrated, items, subtotal, updateQuantity, removeItem } = useCart();
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const [step, setStep] = useState<CheckoutStep>("customer");
  const [customer, setCustomer] = useState({
    name: profile?.full_name ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? ""
  });
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("PICKUP");
  const [address, setAddress] = useState({
    street: "",
    number: "",
    apartment: "",
    city: "Rosario",
    province: "Santa Fe",
    postalCode: "",
    notes: ""
  });
  const [notes, setNotes] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [stockState, setStockState] = useState<StockState>({ status: "idle" });
  const [shippingQuote, setShippingQuote] = useState<ShippingQuoteState>({ status: "idle" });
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("MERCADOPAGO");
  const [loading, setLoading] = useState(false);
  const [processPhase, setProcessPhase] = useState<CheckoutProcessPhase>("idle");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const checkoutInFlightRef = useRef(false);
  const checkoutIntentRef = useRef("");
  const helpHref = getWhatsAppHref("Hola FZAC, necesito ayuda con mi checkout antes de pagar.");
  const deliveryHref = getWhatsAppHref("Hola FZAC, quiero coordinar un envio antes de pagar.");

  const shippingCost = shippingMethod === "DELIVERY" && shippingQuote.status === "ok" ? shippingQuote.amount : 0;
  const total = subtotal + shippingCost;
  const stepIndex = checkoutSteps.findIndex((item) => item.id === step);
  const addressComplete = Boolean(address.street.trim() && address.number.trim() && address.city.trim() && address.province.trim());
  const basicCustomerComplete = Boolean(customer.name.trim() && customer.email.trim() && customer.phone.trim());
  const customerComplete = basicCustomerComplete && (shippingMethod !== "DELIVERY" || addressComplete);
  const cartFingerprint = useMemo(() => checkoutCartFingerprint(items), [items]);
  const showLoadingScreen = loading && processPhase !== "idle";
  const activeLoadingPhase: CheckoutLoadingPhase = processPhase === "idle" ? "validating" : processPhase;

  function checkoutIntentKey() {
    if (!checkoutIntentRef.current) {
      checkoutIntentRef.current = createCheckoutIntentId();
      writeCheckoutIntentSnapshot({
        fingerprint: cartFingerprint,
        paymentMode,
        key: checkoutIntentRef.current,
        createdAt: Date.now()
      });
    }
    return checkoutIntentRef.current;
  }

  async function validateStock(signal?: AbortSignal) {
    if (!items.length) {
      setStockState({ status: "idle" });
      return false;
    }

    setStockState({ status: "loading" });
    const response = await fetch("/api/cart/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: checkoutItems(items)
      }),
      signal
    });
    const data = (await response.json()) as { message?: string; items?: StockIssue[]; error?: string };

    if (!response.ok) {
      setStockState({
        status: "error",
        message: data.message || "No hay stock suficiente para completar la compra.",
        items: data.items ?? []
      });
      return false;
    }

    setStockState({ status: "ok" });
    return true;
  }

  async function quoteShipping(forceDelivery = shippingMethod === "DELIVERY") {
    if (!forceDelivery) {
      setShippingQuote({ status: "idle" });
      return true;
    }

    if (!addressComplete) {
      setShippingQuote({ status: "error", message: "Completa direccion, numero, ciudad y provincia para cotizar envio." });
      return false;
    }

    setShippingQuote({ status: "loading" });
    const response = await fetch("/api/shipping/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(address)
    });
    const data = (await response.json()) as {
      available?: boolean;
      amount?: number;
      distanceKm?: number;
      durationText?: string;
      reason?: string;
      message?: string;
    };

    if (!response.ok || !data.available) {
      setShippingQuote({
        status: "error",
        message: data.reason || data.message || "No pudimos cotizar el envio con datos reales.",
        distanceKm: data.distanceKm
      });
      return false;
    }

    setShippingQuote({
      status: "ok",
      amount: Number(data.amount ?? 0),
      distanceKm: Number(data.distanceKm ?? 0),
      durationText: data.durationText
    });
    return true;
  }

  useEffect(() => {
    if (!hydrated || !items.length) {
      checkoutIntentRef.current = "";
      clearCheckoutIntentSnapshot();
      return;
    }

    const existing = readCheckoutIntentSnapshot();
    if (existing?.fingerprint === cartFingerprint && existing.paymentMode === paymentMode) {
      checkoutIntentRef.current = existing.key;
      return;
    }

    checkoutIntentRef.current = createCheckoutIntentId();
    writeCheckoutIntentSnapshot({
      fingerprint: cartFingerprint,
      paymentMode,
      key: checkoutIntentRef.current,
      createdAt: Date.now()
    });
  }, [hydrated, items.length, cartFingerprint, paymentMode]);

  useEffect(() => {
    if (!items.length) return;

    const controller = new AbortController();
    window.queueMicrotask(() => {
      validateStock(controller.signal).catch(() => {
        if (!controller.signal.aborted) {
          setStockState({ status: "error", message: "No pudimos validar el stock.", items: [] });
        }
      });
    });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    function handleEnter(event: KeyboardEvent) {
      if (event.key !== "Enter" || loading) return;

      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-checkout-form='true']")) return;
      if (target.tagName === "TEXTAREA") return;

      event.preventDefault();
      primaryActionRef.current?.click();
    }

    document.addEventListener("keydown", handleEnter);
    return () => document.removeEventListener("keydown", handleEnter);
  }, [loading]);

  const canSubmit = useMemo(() => {
    if (step !== "payment") return false;
    if (!items.length || !accepted || !customerComplete) return false;
    if (stockState.status !== "ok") return false;
    if (shippingMethod === "DELIVERY" && shippingQuote.status !== "ok") return false;
    return true;
  }, [step, items.length, accepted, customerComplete, stockState.status, shippingMethod, shippingQuote.status]);

  function progressClass(target: CheckoutStep) {
    const targetIndex = checkoutSteps.findIndex((item) => item.id === target);
    if (targetIndex < stepIndex) return "completed";
    if (target === step) return "active";
    return "";
  }

  function goToDelivery() {
    if (!basicCustomerComplete) {
      setError("Completa nombre, email y telefono para continuar.");
      return;
    }
    setError("");
    setStep("delivery");
  }

  function goToReview() {
    setError("");
    void (async () => {
      setLoading(true);
      setProcessPhase(shippingMethod === "DELIVERY" ? "shipping" : "idle");
      try {
        const quoted = await quoteShipping();
        if (quoted) setStep("review");
      } finally {
        setLoading(false);
        setProcessPhase("idle");
      }
    })();
  }

  function selectPaymentMode(mode: PaymentMode) {
    setPaymentMode(mode);
    setError("");
    setInfo("");
  }

  function requestTermsAcceptance() {
    setTermsOpen(true);
  }

  function acceptTerms() {
    setAccepted(true);
    setTermsOpen(false);
  }

  async function goToPayment() {
    setError("");
    setLoading(true);
    setProcessPhase(shippingMethod === "DELIVERY" ? "shipping" : "validating");
    try {
      const quoted = await quoteShipping();
      if (!quoted) return;
      setProcessPhase("validating");
      const stockOk = await validateStock();
      if (stockOk) setStep("payment");
    } finally {
      setLoading(false);
      setProcessPhase("idle");
    }
  }

  async function startMercadoPagoPayment() {
    if (!canSubmit || loading || checkoutInFlightRef.current) return;

    checkoutInFlightRef.current = true;
    setLoading(true);
    setProcessPhase(shippingMethod === "DELIVERY" ? "shipping" : "validating");
    setError("");
    setInfo("");
    let keepBusy = false;

    try {
      const quoted = await quoteShipping();
      if (!quoted) return;

      setProcessPhase("validating");
      const stockOk = await validateStock();
      if (!stockOk) return;

      setProcessPhase("creating");
      const response = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: checkoutItems(items),
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          shipping_method: shippingMethod,
          address_snapshot: address,
          notes,
          payment_method: "MERCADOPAGO",
          idempotency_key: checkoutIntentKey()
        })
      });

      const data = (await response.json()) as {
        redirect_url?: string;
        url?: string;
        init_point?: string;
        sandbox_init_point?: string;
        pending?: boolean;
        orderId?: string;
        order_id?: string;
        order_status?: string;
        requires_admin_approval?: boolean;
        preference_id?: string;
        message?: string;
        error?: string;
        items?: StockIssue[];
      };

      if (!response.ok) {
        if (response.status === 409 && data.error === "INSUFFICIENT_STOCK") {
          setStockState({
            status: "error",
            message: data.message || "No hay stock suficiente para completar la compra.",
            items: data.items ?? []
          });
          setStep("review");
          return;
        }
        if (response.status === 422 && data.error === "SHIPPING_QUOTE_UNAVAILABLE") {
          setError(data.message || "No pudimos cotizar el envio con datos reales.");
          setStep("delivery");
          return;
        }
        if (
          response.status === 503 &&
          (data.error === "PAYMENT_PROVIDER_NOT_CONFIGURED" || data.error === "MERCADOPAGO_NOT_CONFIGURED")
        ) {
          setError("Mercado Pago todavia no esta configurado para iniciar pagos. Completa la credencial del entorno correcto y reinicia el servidor.");
          return;
        }
        if (response.status === 502 && data.error === "PAYMENT_PREFERENCE_REJECTED") {
          setError(data.message || "No pudimos iniciar Mercado Pago. Revisa que las credenciales correspondan al entorno configurado.");
          return;
        }
        throw new Error(data.message || "No pudimos crear el checkout.");
      }

      const paymentUrl = data.redirect_url || data.url;
      const orderId = data.orderId || data.order_id;

      if (data.requires_admin_approval && orderId) {
        setProcessPhase("confirming");
        keepBusy = true;
        setInfo(
          data.message ||
            "Tu compra requiere validacion de FZAC por el monto o volumen del pedido. El equipo la revisara y te contactara."
        );
        router.push(`/checkout/pending?orderId=${orderId}&approval=1`);
        return;
      }

      if (paymentUrl) {
        setProcessPhase("redirecting");
        keepBusy = true;
        window.location.assign(paymentUrl);
        return;
      }

      if (data.pending && orderId) {
        setProcessPhase("confirming");
        keepBusy = true;
        router.push(`/checkout/pending?orderId=${orderId}`);
        return;
      }

      throw new Error("El checkout no devolvio un resultado valido.");
    } catch (checkoutError) {
      setProcessPhase("error");
      setError(checkoutError instanceof Error ? checkoutError.message : "No pudimos iniciar el pago.");
    } finally {
      checkoutInFlightRef.current = keepBusy;
      if (!keepBusy) {
        setLoading(false);
        setProcessPhase("idle");
      }
    }
  }

  async function startCoordinatedPayment(method: "BANK_TRANSFER" | "WHATSAPP") {
    if (!canSubmit || loading || checkoutInFlightRef.current) return;

    checkoutInFlightRef.current = true;
    setLoading(true);
    setProcessPhase(shippingMethod === "DELIVERY" ? "shipping" : "validating");
    setError("");
    setInfo("");
    let keepBusy = false;

    try {
      const quoted = await quoteShipping();
      if (!quoted) return;

      setProcessPhase("validating");
      const stockOk = await validateStock();
      if (!stockOk) return;

      setProcessPhase("creating");
      const response = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: checkoutItems(items),
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          shipping_method: shippingMethod,
          address_snapshot: address,
          notes,
          payment_method: method,
          idempotency_key: checkoutIntentKey()
        })
      });

      const data = (await response.json()) as {
        orderId?: string;
        order_id?: string;
        whatsapp_url?: string;
        whatsappUrl?: string;
        message?: string;
        error?: string;
        items?: StockIssue[];
      };

      if (!response.ok) {
        if (response.status === 409 && data.error === "INSUFFICIENT_STOCK") {
          setStockState({
            status: "error",
            message: data.message || "No hay stock suficiente para completar la compra.",
            items: data.items ?? []
          });
          setStep("review");
          return;
        }
        if (response.status === 422 && data.error === "SHIPPING_QUOTE_UNAVAILABLE") {
          setError(data.message || "No pudimos cotizar el envio con datos reales.");
          setStep("delivery");
          return;
        }
        throw new Error(data.message || "No pudimos generar el pedido.");
      }

      const orderId = data.orderId || data.order_id;
      if (orderId) {
        setProcessPhase("confirming");
        keepBusy = true;
        router.push(`/checkout/pending?orderId=${orderId}&${method === "BANK_TRANSFER" ? "transfer" : "whatsapp"}=1`);
        return;
      }

      setInfo(data.message || "Pedido generado correctamente. FZAC revisara la informacion para coordinar el pago.");
    } catch (coordinationError) {
      setProcessPhase("error");
      setError(coordinationError instanceof Error ? coordinationError.message : "No pudimos generar el pedido.");
    } finally {
      checkoutInFlightRef.current = keepBusy;
      if (!keepBusy) {
        setLoading(false);
        setProcessPhase("idle");
      }
    }
  }

  if (!hydrated) {
    return (
      <main className="page-section">
        <div className="container empty-state">
          <div>
            <Package size={38} />
            <h1>Cargando checkout</h1>
            <p>Estamos preparando tu carrito guardado para validar stock y pago.</p>
          </div>
        </div>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="page-section">
        <div className="container empty-state">
          <div>
            <Package size={38} />
            <h1>No hay productos para pagar</h1>
            <p>Agrega productos al carrito antes de iniciar el checkout.</p>
            <Link className="btn" href="/productos">
              Ver productos
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="kicker">Checkout seguro</span>
            <h1>Confirma tu compra</h1>
            <p>Completas los datos por pasos y al final queda solo el resumen, terminos y pago.</p>
          </div>
        </div>

        <div className="checkout-progress">
          {checkoutSteps.map((item) => (
            <span className={progressClass(item.id)} key={item.id}>
              {item.label}
            </span>
          ))}
        </div>

        <div
          className={`checkout-layout ${step === "payment" ? "checkout-layout--payment" : ""}`}
          data-checkout-form="true"
        >
          {step !== "payment" ? (
            <div className="checkout-steps">
              {step === "customer" ? (
                <section className="checkout-panel">
                  <h2>
                    <UserRound size={18} /> Datos del comprador
                  </h2>
                  <p className="checkout-panel__hint">
                    Nombre, email y telefono son obligatorios. La direccion se usa para envio; si elegis retiro, podes
                    completarla despues al coordinar con FZAC.
                  </p>
                  <div className="form-grid">
                    <label>
                      Nombre y apellido
                      <input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} required />
                    </label>
                    <label>
                      Email
                      <input type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} required />
                    </label>
                    <label>
                      Telefono
                      <input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} required />
                    </label>
                    <label>
                      Calle
                      <input value={address.street} onChange={(event) => setAddress({ ...address, street: event.target.value })} />
                    </label>
                    <label>
                      Numero
                      <input value={address.number} onChange={(event) => setAddress({ ...address, number: event.target.value })} />
                    </label>
                    <label>
                      Departamento
                      <input value={address.apartment} onChange={(event) => setAddress({ ...address, apartment: event.target.value })} />
                    </label>
                    <label>
                      Ciudad
                      <input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} />
                    </label>
                    <label>
                      Provincia
                      <input value={address.province} onChange={(event) => setAddress({ ...address, province: event.target.value })} />
                    </label>
                    <label>
                      Codigo postal
                      <input value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} />
                    </label>
                  </div>
                  {error ? <p className="notice notice--danger">{error}</p> : null}
                  <div className="checkout-panel__actions">
                    <button className="btn" ref={primaryActionRef} type="button" disabled={loading} onClick={goToDelivery}>
                      Continuar <ArrowRight size={17} />
                    </button>
                  </div>
                </section>
              ) : null}

              {step === "delivery" ? (
                <section className="checkout-panel">
                  <h2>
                    <Truck size={18} /> Entrega o retiro
                  </h2>
                  <div className="checkout-methods">
                    <button
                      type="button"
                      className="method-button"
                      aria-pressed={shippingMethod === "PICKUP"}
                      onClick={() => {
                        setShippingMethod("PICKUP");
                        setShippingQuote({ status: "idle" });
                      }}
                    >
                      <Package size={20} />
                      <strong>Retiro coordinado</strong>
                      <span>Retiras en FZAC cuando administracion confirme disponibilidad.</span>
                    </button>
                    <button
                      type="button"
                      className="method-button"
                      aria-pressed={shippingMethod === "DELIVERY"}
                      onClick={() => {
                        setShippingMethod("DELIVERY");
                        window.setTimeout(() => void quoteShipping(true), 0);
                      }}
                    >
                      <Truck size={20} />
                      <strong>Envio cotizado</strong>
                      <span>Hasta 30 km de Rosario con direccion real y tarifa vigente configurada.</span>
                    </button>
                    <a className="method-button" href={deliveryHref} target="_blank" rel="noreferrer">
                      <MessageCircle size={20} />
                      <strong>Coordinar consulta</strong>
                      <span>Para pedidos especiales o dudas antes de pagar.</span>
                    </a>
                  </div>

                  {shippingMethod === "DELIVERY" ? (
                    <div className="checkout-subpanel">
                      <h3>
                        <MapPin size={17} /> Direccion registrada
                      </h3>
                      <p>
                        {address.street} {address.number}
                        {address.apartment ? `, ${address.apartment}` : ""}, {address.city}, {address.province}
                        {address.postalCode ? ` (${address.postalCode})` : ""}.
                      </p>
                      <button className="btn btn--ghost" type="button" onClick={() => setStep("customer")}>
                        Editar direccion
                      </button>
                      <button className="btn" type="button" disabled={shippingQuote.status === "loading"} onClick={() => void quoteShipping()}>
                        {shippingQuote.status === "loading" ? <Loader2 size={17} /> : <Truck size={17} />}
                        Cotizar envio
                      </button>
                      {shippingQuote.status === "ok" ? (
                        <p className="notice notice--success">
                          Envio cotizado: {currency(shippingQuote.amount)} ({shippingQuote.distanceKm} km
                          {shippingQuote.durationText ? `, ${shippingQuote.durationText}` : ""}).
                        </p>
                      ) : null}
                      {shippingQuote.status === "error" ? (
                        <p className="notice notice--danger">
                          {shippingQuote.message}
                          {shippingQuote.distanceKm ? ` Distancia detectada: ${shippingQuote.distanceKm} km.` : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="checkout-panel__actions">
                    <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => setStep("customer")}>
                      <ArrowLeft size={17} /> Volver
                    </button>
                    <button className="btn" ref={primaryActionRef} type="button" disabled={loading} onClick={goToReview}>
                      {loading ? <Loader2 size={17} /> : <ArrowRight size={17} />}
                      Continuar
                    </button>
                  </div>
                </section>
              ) : null}

              {step === "review" ? (
                <section className="checkout-panel">
                  <h2>
                    <ShieldCheck size={18} /> Revision del pedido
                  </h2>
                  <div className="payment-note">
                    <ShieldCheck size={18} />
                    <p>Validamos stock, cantidades y datos antes de habilitar el pago. El stock se descuenta solo con pago aprobado.</p>
                  </div>
                  <label className="field" style={{ marginTop: 14 }}>
                    Notas del pedido
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
                  </label>
                  {stockState.status === "loading" ? <p className="notice">Validando productos y stock disponible...</p> : null}
                  {stockState.status === "ok" ? <p className="notice notice--success">Productos disponibles. Podes continuar al pago.</p> : null}
                  {stockState.status === "error" ? (
                    <div className="notice notice--danger">
                      <strong>{stockState.message}</strong>
                      {stockState.items.length ? (
                        <ul className="stock-issue-list">
                          {stockState.items.map((item) => (
                            <li key={item.productId}>
                              {item.name ?? item.productId}: pediste {item.requested}, disponibles {item.available}.
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <a className="checkout-help-link checkout-help-link--danger" href={helpHref} target="_blank" rel="noreferrer">
                        <MessageCircle size={17} />
                        Consultar disponibilidad con FZAC
                      </a>
                    </div>
                  ) : null}
                  <div className="checkout-panel__actions">
                    <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => setStep("delivery")}>
                      <ArrowLeft size={17} /> Volver
                    </button>
                    <button className="btn" ref={primaryActionRef} type="button" disabled={loading || stockState.status === "loading"} onClick={() => void goToPayment()}>
                      {loading ? <Loader2 size={17} /> : <ArrowRight size={17} />}
                      Continuar al pago
                    </button>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          <aside className={`checkout-summary ${step === "payment" ? "checkout-summary--final" : ""}`}>
            <h2>{step === "payment" ? "Pago" : "Resumen"}</h2>
            <div className="checkout-floating-products">
              {items.map((item) => (
                <article className="checkout-floating-product" key={item.productId}>
                  <Image src={item.product.image_url} alt={item.product.name} width={58} height={58} />
                  <div>
                    <strong>{item.product.name}</strong>
                    <span>
                      {item.quantity} x {currency(item.product.price)}
                    </span>
                    <small className={item.product.stock > 0 ? "status-pill status-pill--success" : "status-pill status-pill--danger"}>
                      Stock {item.product.stock}
                    </small>
                  </div>
                  <div className="checkout-floating-product__actions">
                    <strong>{currency(item.product.price * item.quantity)}</strong>
                    <span>
                      <button type="button" disabled={item.quantity <= 1} onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                        <Minus size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={item.quantity >= item.product.stock}
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      >
                        <Plus size={13} />
                      </button>
                      <button type="button" onClick={() => removeItem(item.productId)}>
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </div>
                </article>
              ))}
            </div>
            <div className="summary-line">
              <span>Subtotal</span>
              <strong>{currency(subtotal)}</strong>
            </div>
            <div className="summary-line">
              <span>{shippingMethod === "DELIVERY" ? "Envio" : "Retiro"}</span>
              <strong>
                {shippingMethod === "DELIVERY"
                  ? shippingQuote.status === "ok"
                    ? currency(shippingQuote.amount)
                    : "Pendiente de cotizacion"
                  : "Sin costo"}
              </strong>
            </div>
            <p className="checkout-summary__payment">
              {shippingMethod === "DELIVERY"
                ? "El envio se suma solo cuando hay cotizacion real por direccion y tarifa vigente."
                : "Retiro coordinado no suma costo de envio."}
            </p>
            <div className="summary-total">
              <span>Total</span>
              <strong>{currency(total)}</strong>
            </div>

            {step === "payment" ? (
              <>
                {paymentsTestMode ? (
                  <div className="payment-env-badge" aria-label="Entorno de prueba de pagos">
                    <strong>Entorno de prueba</strong>
                    <span>Usa un comprador TESTUSER de Mercado Pago. No se cobrara dinero real.</span>
                  </div>
                ) : null}
                <div className="payment-mode-grid" role="group" aria-label="Medio de pago">
                  <button
                    type="button"
                    className="payment-mode-button payment-mode-button--redirect"
                    aria-pressed={paymentMode === "MERCADOPAGO"}
                    disabled={loading}
                    onClick={() => selectPaymentMode("MERCADOPAGO")}
                  >
                    <Landmark size={18} />
                    <strong>Pagar con Mercado Pago</strong>
                    <span>Paga online con los medios disponibles dentro de Mercado Pago.</span>
                  </button>
                  <button
                    type="button"
                    className="payment-mode-button payment-mode-button--transfer"
                    aria-pressed={paymentMode === "BANK_TRANSFER"}
                    disabled={loading}
                    onClick={() => selectPaymentMode("BANK_TRANSFER")}
                  >
                    <Landmark size={18} />
                    <strong>Solicitar pago por transferencia</strong>
                    <span>Genera el pedido y FZAC te enviara los datos para transferir.</span>
                  </button>
                  <button
                    type="button"
                    className="payment-mode-button payment-mode-button--whatsapp"
                    aria-pressed={paymentMode === "WHATSAPP"}
                    disabled={loading}
                    onClick={() => selectPaymentMode("WHATSAPP")}
                  >
                    <MessageCircle size={18} />
                    <strong>Coordinar por WhatsApp</strong>
                    <span>Genera el pedido y coordina el pago o entrega con FZAC.</span>
                  </button>
                </div>
                <p className="payment-method-hint">
                  {paymentMode === "MERCADOPAGO"
                    ? "Solo esta opcion crea preferencia y abre Mercado Pago."
                    : paymentMode === "BANK_TRANSFER"
                      ? "Transferencia no abre Mercado Pago: el pedido queda pendiente para que FZAC revise stock, total y te envie los datos bancarios."
                      : "WhatsApp no abre Mercado Pago: FZAC recibira el pedido y podras coordinar pago, retiro o entrega."}
                </p>
                <div className="terms-checkbox">
                  <input
                    type="checkbox"
                    id="accept-terms"
                    checked={accepted}
                    onChange={(event) => {
                      if (event.target.checked) {
                        requestTermsAcceptance();
                      } else {
                        setAccepted(false);
                      }
                    }}
                  />
                  <div className="terms-checkbox__copy">
                    <span>Acepto los{" "}</span>
                    <button className="terms-inline-button" type="button" onClick={requestTermsAcceptance}>
                      Terminos y condiciones
                    </button>{" "}
                    <span>y la{" "}</span>
                    <Link href="/privacidad" target="_blank" rel="noopener noreferrer">
                      Politica de privacidad
                    </Link>
                    .
                  </div>
                </div>
                {error ? <p className="notice notice--danger">{error}</p> : null}
                {info ? <p className="notice notice--success">{info}</p> : null}
                {paymentMode === "MERCADOPAGO" ? (
                  <button
                    className={`btn checkout-pay-button ${loading ? "checkout-pay-button--processing" : ""}`}
                    ref={primaryActionRef}
                    type="button"
                    disabled={!canSubmit || loading}
                    aria-busy={loading}
                    onClick={() => void startMercadoPagoPayment()}
                  >
                    {loading ? <Loader2 size={18} /> : <ExternalLink size={18} />}
                    {loading ? "Preparando pago seguro..." : "Pagar con Mercado Pago"}
                  </button>
                ) : paymentMode === "BANK_TRANSFER" ? (
                  <button
                    className={`btn checkout-pay-button ${loading ? "checkout-pay-button--processing" : ""}`}
                    ref={primaryActionRef}
                    type="button"
                    disabled={!canSubmit || loading}
                    aria-busy={loading}
                    onClick={() => void startCoordinatedPayment("BANK_TRANSFER")}
                  >
                    {loading ? <Loader2 size={18} /> : <Landmark size={18} />}
                    {loading ? "Generando pedido..." : "Generar pedido por transferencia"}
                  </button>
                ) : (
                  <button
                    className={`btn checkout-pay-button ${loading ? "checkout-pay-button--processing" : ""}`}
                    ref={primaryActionRef}
                    type="button"
                    disabled={!canSubmit || loading}
                    aria-busy={loading}
                    onClick={() => void startCoordinatedPayment("WHATSAPP")}
                  >
                    {loading ? <Loader2 size={18} /> : <MessageCircle size={18} />}
                    {loading ? "Generando pedido..." : "Coordinar por WhatsApp"}
                  </button>
                )}
                <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => setStep("review")}>
                  <ArrowLeft size={17} /> Revisar datos
                </button>
              </>
            ) : (
              <p className="checkout-summary__payment">Completa los pasos para habilitar el pago online.</p>
            )}
          </aside>
        </div>
      </div>
      {showLoadingScreen ? (
        <CheckoutLoadingScreen method={paymentMode} phase={activeLoadingPhase} errorMessage={error} />
      ) : null}
      {termsOpen ? (
        <div className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-modal-title">
          <div className="terms-modal__panel">
            <header>
              <span className="kicker">Legal FZAC</span>
              <h2 id="terms-modal-title">Terminos y condiciones</h2>
              <p>Revisa estas condiciones antes de confirmar el pago. Se mantienen disponibles en la seccion legal de la tienda.</p>
            </header>
            <div className="terms-modal__content">
              <section>
                <h3>Compra y comprobante</h3>
                <p>
                  La compra se confirma solo cuando el proveedor de pago aprueba la operacion. No se descuenta stock ni
                  se emite comprobante hasta que el pago queda aprobado.
                </p>
              </section>
              <section>
                <h3>Entrega y retiro</h3>
                <p>
                  El cliente debe revisar la mercaderia antes de firmar el remito. Para defectos ocultos o errores no
                  visibles, debe informar a FZAC dentro de las 48 horas habiles con fotos y comprobante.
                </p>
              </section>
              <section>
                <h3>Derecho de revocacion</h3>
                <p>
                  Conforme a la Ley 24.240, el cliente puede revocar compras a distancia dentro de los diez (10) dias
                  corridos desde la entrega o celebracion del contrato, segun corresponda.
                </p>
              </section>
              <section>
                <h3>Excepciones por materiales de obra</h3>
                <p>
                  Pueden quedar excluidos materiales a granel, fraccionados, cortados a medida, preparados a pedido o
                  deteriorados por humedad, mala estiba, uso, instalacion o exposicion climatica.
                </p>
              </section>
              <section>
                <h3>Garantias</h3>
                <p>
                  Herramientas y maquinas cuentan con garantia legal contra defectos de fabricacion. Las garantias de
                  marca deben gestionarse con factura o comprobante en centros autorizados cuando corresponda.
                </p>
              </section>
              <section>
                <h3>Pagos seguros</h3>
                <p>
                  FZAC no solicita ni almacena numeros de tarjeta, codigos de seguridad ni datos sensibles de medios de
                  pago. Las tarjetas se procesan mediante proveedor habilitado.
                </p>
              </section>
            </div>
            <footer>
              <Link className="btn btn--ghost" href="/terminos" target="_blank" rel="noopener noreferrer">
                Ver texto completo
              </Link>
              <button className="btn btn--ghost" type="button" onClick={() => setTermsOpen(false)}>
                Volver
              </button>
              <button className="btn" type="button" onClick={acceptTerms}>
                Acepto terminos y condiciones
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </main>
  );
}
