"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, CreditCard, Loader2, MapPin, MessageCircle, Package, ShieldCheck, Truck, UserRound } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency } from "@/lib/formatters/currency";
import { getWhatsAppHref } from "@/lib/utils/contact";
import type { SessionProfile } from "@/lib/auth/get-user";
import type { ShippingMethod } from "@/types/domain";

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

function checkoutItems(items: ReturnType<typeof useCart>["items"]) {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity
  }));
}

export function CheckoutForm({ profile }: { profile: SessionProfile | null }) {
  const router = useRouter();
  const { hydrated, items, subtotal } = useCart();
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
  const [stockState, setStockState] = useState<StockState>({ status: "idle" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const helpHref = getWhatsAppHref("Hola FZAC, necesito ayuda con mi checkout antes de pagar.");
  const deliveryHref = getWhatsAppHref("Hola FZAC, quiero coordinar un envio antes de pagar.");

  const total = subtotal;

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

  const canSubmit = useMemo(() => {
    if (!items.length || !accepted || !customer.name || !customer.email || !customer.phone) return false;
    if (stockState.status !== "ok") return false;
    return true;
  }, [items.length, accepted, customer, stockState.status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setError("");

    try {
      const stockOk = await validateStock();
      if (!stockOk) return;

      const response = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: checkoutItems(items),
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          shipping_method: shippingMethod,
          address_snapshot: shippingMethod === "DELIVERY" ? address : null,
          notes
        })
      });

      const data = (await response.json()) as {
        url?: string;
        init_point?: string;
        sandbox_init_point?: string;
        pending?: boolean;
        orderId?: string;
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
          return;
        }
        if (response.status === 503 && data.error === "MERCADOPAGO_NOT_CONFIGURED") {
          setError("El checkout ya esta preparado. Falta configurar Mercado Pago para operar en produccion.");
          return;
        }
        throw new Error(data.message || "No pudimos crear el checkout.");
      }

      const paymentUrl = data.init_point || data.url || data.sandbox_init_point;
      if (paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }

      if (data.pending && data.orderId) {
        router.push(`/pago/pendiente?order_id=${data.orderId}`);
        return;
      }

      throw new Error("El checkout no devolvio un resultado valido.");
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "No pudimos iniciar el pago.");
    } finally {
      setLoading(false);
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
            <p>No guardamos tarjetas. Mercado Pago procesa el pago y FZAC confirma la orden de forma segura.</p>
          </div>
        </div>

        <div className="checkout-progress">
          <span className="active">1. Comprador</span>
          <span className={customer.name && customer.email && customer.phone ? "active" : ""}>2. Entrega</span>
          <span className={stockState.status === "ok" ? "active" : ""}>3. Stock</span>
          <span className={accepted && stockState.status === "ok" ? "active" : ""}>4. Pago</span>
        </div>

        <form className="checkout-layout" onSubmit={submit}>
          <div className="checkout-steps">
            <section className="checkout-panel">
              <h2>
                <UserRound size={18} /> Datos del comprador
              </h2>
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
              </div>
            </section>

            <section className="checkout-panel">
              <h2>
                <Truck size={18} /> Entrega o retiro
              </h2>
              <div className="checkout-methods">
                <button type="button" className="method-button" aria-pressed={shippingMethod === "PICKUP"} onClick={() => setShippingMethod("PICKUP")}>
                  <Package size={20} />
                  <strong>Retiro coordinado</strong>
                  <span>Retiras en FZAC cuando administracion confirme disponibilidad.</span>
                </button>
                <button type="button" className="method-button" aria-pressed={shippingMethod === "DELIVERY"} onClick={() => setShippingMethod("DELIVERY")}>
                  <MessageCircle size={20} />
                  <strong>Envio por WhatsApp</strong>
                  <span>El costo y horario se calculan por WhatsApp segun zona, volumen y disponibilidad.</span>
                </button>
                <a className="method-button" href={deliveryHref} target="_blank" rel="noreferrer">
                  <MessageCircle size={20} />
                  <strong>Coordinar por WhatsApp</strong>
                  <span>Para pedidos especiales o dudas antes de pagar.</span>
                </a>
              </div>

              {shippingMethod === "DELIVERY" ? (
                <div className="checkout-subpanel">
                  <h3>
                    <MapPin size={17} /> Datos orientativos para coordinar
                  </h3>
                  <p>Estos datos ayudan a cotizar el envio por WhatsApp. No suman costo automatico al pedido.</p>
                  <div className="form-grid">
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
                </div>
              ) : null}
            </section>

            <section className="checkout-panel">
              <h2>
                <CreditCard size={18} /> Pago
              </h2>
              <div className="payment-note">
                <ShieldCheck size={18} />
                <p>
                  El pago se inicia desde un sistema seguro. FZAC no guarda tarjetas; el stock se descuenta solo cuando el proveedor confirma el pago.
                </p>
              </div>
              <label className="field" style={{ marginTop: 14 }}>
                Notas del pedido
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
              </label>
              <div className="terms-checkbox">
                <input
                  type="checkbox"
                  id="accept-terms"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                <label htmlFor="accept-terms">
                  Acepto los{" "}
                  <Link href="/terminos" target="_blank" rel="noopener noreferrer">
                    Terminos y condiciones
                  </Link>{" "}
                  y la{" "}
                  <Link href="/privacidad" target="_blank" rel="noopener noreferrer">
                    Politica de privacidad
                  </Link>
                  .
                </label>
              </div>
              {stockState.status === "loading" ? <p className="notice">Validando productos y stock disponible...</p> : null}
              {stockState.status === "ok" ? (
                <p className="notice notice--success">Productos disponibles. Podes pagar con Mercado Pago cuando aceptes terminos.</p>
              ) : null}
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
              {error ? <p className="notice notice--danger">{error}</p> : null}
            </section>
          </div>

          <aside className="checkout-summary">
            <h2>Resumen</h2>
            {items.map((item) => (
              <div className="summary-line" key={item.productId}>
                <span>
                  {item.quantity} x {item.product.name}
                </span>
                <strong>{currency(item.product.price * item.quantity)}</strong>
              </div>
            ))}
            <div className="summary-line">
              <span>Subtotal</span>
              <strong>{currency(subtotal)}</strong>
            </div>
            <div className="summary-line">
              <span>{shippingMethod === "DELIVERY" ? "Envio" : "Retiro"}</span>
              <strong>{shippingMethod === "DELIVERY" ? "A coordinar por WhatsApp" : "Sin costo"}</strong>
            </div>
            <p className="checkout-summary__payment">El envio no se suma al total: se cotiza por WhatsApp.</p>
            <div className="summary-total">
              <span>Total</span>
              <strong>{currency(total)}</strong>
            </div>
            <button className="btn" type="submit" disabled={!canSubmit || loading}>
              {loading ? <Loader2 size={18} /> : <CheckCircle size={18} />}
              {loading ? "Procesando..." : "Pagar con Mercado Pago"}
            </button>
            <a className="checkout-help-link" href={helpHref} target="_blank" rel="noreferrer">
              <MessageCircle size={17} />
              Necesito ayuda con esta compra
            </a>
          </aside>
        </form>
      </div>
    </main>
  );
}
