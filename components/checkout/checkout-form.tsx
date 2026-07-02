"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle, CreditCard, Loader2, MapPin, Package, ShieldCheck, Truck, UserRound } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { currency } from "@/lib/formatters/currency";
import type { SessionProfile } from "@/lib/auth/get-user";
import type { ShippingMethod } from "@/types/domain";

type DistanceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; distanceKm: number; deliveryAvailable: boolean; zoneSnapshot: string }
  | { status: "error"; message: string };

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
  const [distance, setDistance] = useState<DistanceState>({ status: "idle" });
  const [loading, setLoading] = useState(false);
  const [simulated, setSimulated] = useState<{ orderId: string } | null>(null);
  const [error, setError] = useState("");

  const shippingCost =
    shippingMethod === "DELIVERY" && distance.status === "ok" && distance.deliveryAvailable ? 6500 : 0;
  const total = subtotal + shippingCost;

  const canSubmit = useMemo(() => {
    if (!items.length || !accepted || !customer.name || !customer.email || !customer.phone) return false;
    if (shippingMethod === "DELIVERY") {
      return Boolean(address.street && address.number && address.city && distance.status === "ok");
    }
    return true;
  }, [items.length, accepted, customer, shippingMethod, address, distance.status]);

  async function calculateDistance() {
    setDistance({ status: "loading" });
    setError("");

    try {
      const response = await fetch("/api/maps/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: `${address.street} ${address.number}, ${address.city}, ${address.province}` })
      });
      const data = (await response.json()) as {
        distanceKm?: number;
        deliveryAvailable?: boolean;
        zoneSnapshot?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(data.message || "No pudimos calcular la distancia.");
      setDistance({
        status: "ok",
        distanceKm: Number(data.distanceKm),
        deliveryAvailable: Boolean(data.deliveryAvailable),
        zoneSnapshot: String(data.zoneSnapshot)
      });
    } catch (distanceError) {
      setDistance({
        status: "error",
        message: distanceError instanceof Error ? distanceError.message : "No pudimos calcular la distancia."
      });
    }
  }

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
              ? {
                  ...address,
                  distanceKm: distance.status === "ok" ? distance.distanceKm : undefined,
                  deliveryAvailable: distance.status === "ok" ? distance.deliveryAvailable : undefined,
                  deliveryZoneSnapshot: distance.status === "ok" ? distance.zoneSnapshot : undefined
                }
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
          <span className={shippingMethod === "PICKUP" || distance.status === "ok" ? "active" : ""}>3. Zona</span>
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
                  <span>Disponible hasta 30 km desde Rosario.</span>
                </button>
              </div>

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
                  <button className="btn btn--ghost" type="button" onClick={calculateDistance} style={{ marginTop: 12 }} disabled={distance.status === "loading"}>
                    {distance.status === "loading" ? <Loader2 size={18} /> : <MapPin size={18} />}
                    Calcular distancia
                  </button>
                  {distance.status === "ok" ? (
                    <p className={distance.deliveryAvailable ? "notice notice--success" : "notice notice--danger"}>
                      {distance.distanceKm} km. {distance.zoneSnapshot}
                    </p>
                  ) : null}
                  {distance.status === "error" ? <p className="notice notice--danger">{distance.message}</p> : null}
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
