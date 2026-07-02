"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle, CreditCard, Loader2, MessageCircle, Package, ShieldCheck, Truck, UserRound } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency } from "@/lib/formatters/currency";
import type { SessionProfile } from "@/lib/auth/get-user";
import type { ShippingMethod } from "@/types/domain";

export function CheckoutForm({ profile }: { profile: SessionProfile | null }) {
  const { items, subtotal, clearCart } = useCart();
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
  const [loading, setLoading] = useState(false);
  const [simulated, setSimulated] = useState<{ orderId: string } | null>(null);
  const [error, setError] = useState("");

  const shippingCost = shippingMethod === "DELIVERY" ? 6500 : 0;
  const total = subtotal + shippingCost;

  const canSubmit = useMemo(() => {
    if (!items.length || !accepted || !customer.name || !customer.email || !customer.phone) return false;
    if (shippingMethod === "DELIVERY") {
      return Boolean(address.street && address.number && address.city && address.province);
    }
    return true;
  }, [items.length, accepted, customer, shippingMethod, address]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          customer,
          shippingMethod,
          address:
            shippingMethod === "DELIVERY"
              ? address
              : null,
          notes
        })
      });

      const data = (await response.json()) as { url?: string; mock?: boolean; orderId?: string; message?: string };
      if (!response.ok) throw new Error(data.message || "No pudimos crear el checkout.");

      if (data.url) {
        window.location.assign(data.url);
        return;
      }

      if (data.mock && data.orderId) {
        setSimulated({ orderId: data.orderId });
        return;
      }

      throw new Error("El checkout no devolvio un resultado valido.");
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "No pudimos iniciar el pago.");
    } finally {
      setLoading(false);
    }
  }

  async function simulate(status: "PAID" | "PENDING" | "FAILED") {
    if (!simulated?.orderId) return;
    setLoading(true);

    try {
      await fetch("/api/payments/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: simulated.orderId, status })
      });

      if (status === "PAID") clearCart();
      const target = status === "PAID" ? "aprobado" : status === "FAILED" ? "rechazado" : "pendiente";
      window.location.assign(`/pago/${target}?order_id=${simulated.orderId}&mock=true`);
    } finally {
      setLoading(false);
    }
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
            <h1>Confirmá tu compra</h1>
            <p>No guardamos tarjetas. Mercado Pago procesa medios de pago y FZAC confirma la orden desde backend.</p>
          </div>
        </div>

        <div className="checkout-progress">
          <span className="active">1. Datos</span>
          <span className={customer.name && customer.email ? "active" : ""}>2. Entrega</span>
          <span className={shippingMethod === "PICKUP" || address.street ? "active" : ""}>3. Datos de envio</span>
          <span className={accepted ? "active" : ""}>4. Pago</span>
          <span>5. Confirmacion</span>
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
                  <span>Sin costo. Te avisamos cuando el pedido este listo.</span>
                </button>
                <button type="button" className="method-button" aria-pressed={shippingMethod === "DELIVERY"} onClick={() => setShippingMethod("DELIVERY")}>
                  <Truck size={20} />
                  <strong>Envio FZAC</strong>
                  <span>Entrega coordinada por administracion segun direccion y disponibilidad.</span>
                </button>
                <a className="method-button" href="https://wa.me/5493415847000?text=Hola%20FZAC,%20quiero%20coordinar%20un%20envio" target="_blank" rel="noreferrer">
                  <MessageCircle size={20} />
                  <strong>Coordinar por WhatsApp</strong>
                  <span>Para pedidos especiales o dudas antes de pagar.</span>
                </a>
              </div>
              <p className="notice" style={{ marginTop: 12 }}>
                La direccion se toma como dato operativo y FZAC coordina la entrega o retiro al confirmar la orden.
              </p>

              {shippingMethod === "DELIVERY" ? (
                <>
                  <div className="form-grid" style={{ marginTop: 14 }}>
                    <label>
                      Calle
                      <input value={address.street} onChange={(event) => setAddress({ ...address, street: event.target.value })} required />
                    </label>
                    <label>
                      Numero
                      <input value={address.number} onChange={(event) => setAddress({ ...address, number: event.target.value })} required />
                    </label>
                    <label>
                      Departamento
                      <input value={address.apartment} onChange={(event) => setAddress({ ...address, apartment: event.target.value })} />
                    </label>
                    <label>
                      Ciudad
                      <input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} required />
                    </label>
                    <label>
                      Provincia
                      <input value={address.province} onChange={(event) => setAddress({ ...address, province: event.target.value })} required />
                    </label>
                    <label>
                      Codigo postal
                      <input value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} />
                    </label>
                  </div>
                </>
              ) : null}
            </section>

            <section className="checkout-panel">
              <h2>
                <CreditCard size={18} /> Pago
              </h2>
              <div className="checkout-payment-strip" aria-label="Medios de pago disponibles">
                <span>VISA</span>
                <span>Mastercard</span>
                <span>AMEX</span>
                <span>MP</span>
                <span>Transferencia</span>
              </div>
              <div className="checkout-methods">
                <div className="method-button" aria-pressed="true">
                  <CreditCard size={20} />
                  <strong>Mercado Pago</strong>
                  <span>Tarjeta, dinero en cuenta y medios habilitados por el proveedor.</span>
                </div>
                <div className="method-button" aria-pressed="false">
                  <Banknote size={20} />
                  <strong>Transferencia bancaria</strong>
                  <span>La orden queda pendiente hasta que administracion valide el comprobante.</span>
                </div>
              </div>
              <div className="payment-note">
                <ShieldCheck size={18} />
                <p>
                  FZAC no guarda datos de tarjetas. La transferencia no aprueba el pago automaticamente ni descuenta
                  stock hasta que el panel admin confirme la operacion.
                </p>
              </div>
              <label className="field" style={{ marginTop: 14 }}>
                Notas del pedido
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
              </label>
              <label className="field" style={{ marginTop: 12 }}>
                <span>
                  <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> Acepto{" "}
                  <Link href="/terminos" target="_blank">
                    terminos de compra
                  </Link>{" "}
                  y{" "}
                  <Link href="/privacidad" target="_blank">
                    privacidad
                  </Link>
                  .
                </span>
              </label>
              {error ? <p className="notice notice--danger">{error}</p> : null}
              {simulated ? (
                <div className="notice">
                  <strong>Modo simulacion activo</strong>
                  <p>Elegí un resultado para probar orden, pago, ticket y notificaciones sin usar tarjetas reales.</p>
                  <div className="admin-actions">
                    <button className="btn" type="button" onClick={() => simulate("PAID")} disabled={loading}>
                      Aprobar pago
                    </button>
                    <button className="btn btn--ghost" type="button" onClick={() => simulate("PENDING")} disabled={loading}>
                      Dejar pendiente
                    </button>
                    <button className="btn btn--danger" type="button" onClick={() => simulate("FAILED")} disabled={loading}>
                      Rechazar
                    </button>
                  </div>
                </div>
              ) : null}
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
              <strong>{shippingCost ? currency(shippingCost) : "Sin costo"}</strong>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <strong>{currency(total)}</strong>
            </div>
            <button className="btn" type="submit" disabled={!canSubmit || loading}>
              {loading ? <Loader2 size={18} /> : <CheckCircle size={18} />}
              Continuar al pago
            </button>
          </aside>
        </form>
      </div>
    </main>
  );
}
