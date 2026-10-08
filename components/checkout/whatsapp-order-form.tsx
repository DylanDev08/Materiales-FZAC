"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Clock3,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  UserRound,
  X
} from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { CheckoutLoadingScreen, type CheckoutLoadingPhase } from "@/components/checkout/checkout-loading-screen";
import { currency } from "@/lib/formatters/currency";
import { getProductAvailabilityStatus, productAvailabilityLabel } from "@/lib/products/availability";
import { productLinePricing, promotionLabel } from "@/lib/products/promotions";
import { getWhatsAppHref } from "@/lib/utils/contact";
import {
  isSafeUserNote,
  isValidArgentinePhone,
  limitPhoneInput,
  normalizeArgentinePhone,
  normalizePhoneDigits,
  normalizeUserNote
} from "@/lib/validations/security";
import type { SessionProfile } from "@/lib/auth/get-user";
import type { Product, ShippingMethod } from "@/types/domain";

type CheckoutStep = "customer" | "delivery" | "review" | "confirm";
type FieldState = { status: "idle" | "valid" | "invalid"; message: string };
type StockIssue = { productId: string; requested: number; available: number; name?: string };
type StockState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok" }
  | { status: "error"; message: string; items: StockIssue[] };
type ShippingQuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; amount: number; distanceKm: number; durationText?: string; origin: string; destination: string }
  | { status: "error"; message: string; distanceKm?: number };

type GoogleMapsWindow = typeof window & {
  google?: {
    maps?: {
      places?: {
        Autocomplete: new (
          input: HTMLInputElement,
          options?: Record<string, unknown>
        ) => {
          addListener: (eventName: "place_changed", callback: () => void) => { remove?: () => void };
          getPlace: () => {
            address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
            formatted_address?: string;
            place_id?: string;
          };
        };
      };
    };
  };
};

type LastOrderSnapshot = {
  orderId: string;
  whatsappUrl: string;
  total: number;
  shippingMethod: ShippingMethod;
  message: string;
  createdAt: number;
};

type CheckoutAddressState = {
  placeId: string;
  street: string;
  number: string;
  apartment: string;
  city: string;
  province: string;
  postalCode: string;
  notes: string;
};

const GOOGLE_MAPS_BROWSER_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_SCRIPT_ID = "fzac-google-maps-places";
const CHECKOUT_INTENT_KEY = "fzac.checkout.whatsapp.intent.v1";
const LAST_ORDER_KEY = "fzac.checkout.lastOrder.v1";
const steps: Array<{ id: CheckoutStep; label: string }> = [
  { id: "customer", label: "Comprador" },
  { id: "delivery", label: "Entrega" },
  { id: "review", label: "Revisión" },
  { id: "confirm", label: "Confirmación" }
];

function checkoutItems(items: ReturnType<typeof useCart>["items"]) {
  return items.map((item) => ({
    product_id: item.productId,
    sku: item.product.sku,
    slug: item.product.slug,
    quantity: item.quantity
  }));
}

function createCheckoutIntentId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `fzac-whatsapp-${random}`;
}

function fieldState(value: string, valid: (value: string) => boolean, messages: { valid: string; invalid: string }): FieldState {
  if (!value.trim()) return { status: "idle", message: "" };
  return valid(value) ? { status: "valid", message: messages.valid } : { status: "invalid", message: messages.invalid };
}

function noteState(value: string, maxLength: number): FieldState {
  if (!value.trim()) return { status: "idle", message: "" };
  if (value.length > maxLength) return { status: "invalid", message: `Máximo ${maxLength} caracteres.` };
  if (!isSafeUserNote(value)) return { status: "invalid", message: "No uses código, HTML ni caracteres de consulta en este campo." };
  return { status: "valid", message: "Texto válido." };
}

function nameIsValid(value: string) {
  return /^[\p{L}\p{M}\s.'-]{2,120}$/u.test(value.trim());
}

function emailIsValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeManualAddress(value: CheckoutAddressState): CheckoutAddressState {
  const street = value.street.trim().replace(/\s+/g, " ");
  const number = value.number.trim();
  if (number) return { ...value, street, number };

  // Mobile-friendly shortcut: typing "Córdoba 1452" in Calle fills the
  // height automatically. Requiring 3+ digits avoids treating names such as
  // "Ruta 33" as a house number.
  const match = street.match(/^(.+?)[,\s]+(\d{3,5}[A-Za-z]?(?:[/-][0-9A-Za-z]+)?)$/);
  if (!match) return { ...value, street };

  return {
    ...value,
    placeId: "",
    street: match[1].replace(/,\s*$/, "").trim(),
    number: match[2].trim()
  };
}

function placePart(
  components: Array<{ long_name: string; short_name: string; types: string[] }> | undefined,
  type: string,
  short = false
) {
  const component = components?.find((item) => item.types.includes(type));
  return short ? component?.short_name ?? "" : component?.long_name ?? "";
}

function loadGoogleMapsPlaces() {
  if (!GOOGLE_MAPS_BROWSER_KEY || typeof window === "undefined") return Promise.resolve(false);
  const mapsWindow = window as GoogleMapsWindow;
  if (mapsWindow.google?.maps?.places?.Autocomplete) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(mapsWindow.google?.maps?.places?.Autocomplete)), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_BROWSER_KEY
    )}&libraries=places&language=es&region=AR`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(mapsWindow.google?.maps?.places?.Autocomplete));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function productQuantityLimit(product: Product) {
  return getProductAvailabilityStatus(product) === "CONSULT" ? 999 : Math.max(1, product.stock);
}

export function WhatsAppOrderForm({ profile }: { profile: SessionProfile | null }) {
  const router = useRouter();
  const { hydrated, items, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const streetInputRef = useRef<HTMLInputElement | null>(null);
  const checkoutInFlightRef = useRef(false);
  const [step, setStep] = useState<CheckoutStep>("customer");
  const [customer, setCustomer] = useState({
    name: profile?.full_name ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? ""
  });
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("PICKUP");
  const [address, setAddress] = useState<CheckoutAddressState>({
    placeId: "",
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
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [stockState, setStockState] = useState<StockState>({ status: "idle" });
  const [shippingQuote, setShippingQuote] = useState<ShippingQuoteState>({ status: "idle" });
  const [placesReady, setPlacesReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processPhase, setProcessPhase] = useState<CheckoutLoadingPhase>("validating");
  const [error, setError] = useState("");

  const helpHref = getWhatsAppHref("Hola FZAC, necesito ayuda con mi pedido antes de confirmarlo.");
  const deliveryHref = getWhatsAppHref("Hola FZAC, quiero consultar por un envío antes de confirmar mi pedido.");
  const shippingCost = shippingMethod === "DELIVERY" && shippingQuote.status === "ok" ? shippingQuote.amount : 0;
  const total = subtotal + shippingCost;
  const stepIndex = steps.findIndex((item) => item.id === step);

  const customerStates = useMemo(
    () => ({
      name: fieldState(customer.name, nameIsValid, { valid: "Nombre válido.", invalid: "Usá nombre y apellido, sin números ni código." }),
      email: fieldState(customer.email, emailIsValid, { valid: "Email válido.", invalid: "Ingresá un email válido con @ y dominio." }),
      phone: fieldState(customer.phone, isValidArgentinePhone, {
        valid: "Teléfono válido.",
        invalid: "Usá 10 dígitos o prefijo 54/549 con número argentino."
      })
    }),
    [customer.email, customer.name, customer.phone]
  );

  const addressStates = useMemo(
    () => ({
      street: fieldState(address.street, (value) => value.trim().length >= 2 && isSafeUserNote(value), {
        valid: "Calle válida.",
        invalid: "Ingresá una calle válida."
      }),
      number: fieldState(address.number, (value) => /^[0-9A-Za-z\s/-]{1,30}$/.test(value.trim()), {
        valid: "Altura válida.",
        invalid: "Ingresá una altura válida."
      }),
      city: fieldState(address.city, (value) => value.trim().length >= 2 && isSafeUserNote(value), {
        valid: "Ciudad válida.",
        invalid: "Ingresá una ciudad válida."
      }),
      province: fieldState(address.province, (value) => value.trim().length >= 2 && isSafeUserNote(value), {
        valid: "Provincia válida.",
        invalid: "Ingresá una provincia válida."
      }),
      notes: noteState(address.notes, 240)
    }),
    [address.city, address.notes, address.number, address.province, address.street]
  );
  const orderNotesState = useMemo(() => noteState(notes, 500), [notes]);
  const basicCustomerComplete =
    customerStates.name.status === "valid" && customerStates.email.status === "valid" && customerStates.phone.status === "valid";
  const cartFingerprint = useMemo(
    () => items.map((item) => `${item.productId}:${item.quantity}`).sort().join("|"),
    [items]
  );
  const checkoutFingerprint = useMemo(
    () => JSON.stringify({
      cart: cartFingerprint,
      shippingMethod,
      customer: [customer.name.trim(), customer.email.trim().toLowerCase(), customer.phone.trim()],
      address: shippingMethod === "DELIVERY" ? normalizeManualAddress(address) : null,
      notes: normalizeUserNote(notes, 500)
    }),
    [address, cartFingerprint, customer.email, customer.name, customer.phone, notes, shippingMethod]
  );

  function validationMessage(state: FieldState) {
    if (state.status === "idle") return null;
    return <span className={`checkout-field-message checkout-field-message--${state.status}`}>{state.message}</span>;
  }

  function updateAddressField(field: keyof CheckoutAddressState, value: string) {
    setAddress((current) => ({
      ...current,
      [field]: value,
      // Editing these textual parts switches to server-side geocoding. Editing
      // only the house number can keep the selected Places hint safely.
      ...(field === "street" || field === "city" || field === "province" ? { placeId: "" } : {})
    }));
    setShippingQuote({ status: "idle" });
  }

  function normalizeStreetAndNumber() {
    setAddress((current) => normalizeManualAddress(current));
  }

  function getIntentKey() {
    if (typeof window === "undefined") return createCheckoutIntentId();
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(CHECKOUT_INTENT_KEY) || "null") as
        | { fingerprint?: string; key?: string }
        | null;
      if (stored?.fingerprint === checkoutFingerprint && stored.key) return stored.key;
    } catch {
      // Ignore malformed local state and replace it with a new idempotency key.
    }
    const key = createCheckoutIntentId();
    window.sessionStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify({ fingerprint: checkoutFingerprint, key }));
    return key;
  }

  function clearIntent() {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
  }

  function checkoutAddressSnapshot() {
    const normalized = normalizeManualAddress(address);
    return { ...normalized, notes: normalizeUserNote(normalized.notes, 240) };
  }

  async function validateStock(signal?: AbortSignal) {
    if (!items.length) return false;
    setStockState({ status: "loading" });
    const response = await fetch("/api/cart/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: checkoutItems(items) }),
      signal
    });
    const data = (await response.json()) as { message?: string; items?: StockIssue[] };
    if (!response.ok) {
      setStockState({
        status: "error",
        message: data.message || "No pudimos validar la disponibilidad del pedido.",
        items: data.items ?? []
      });
      return false;
    }
    setStockState({ status: "ok" });
    return true;
  }

  async function quoteShipping() {
    if (shippingMethod !== "DELIVERY") {
      setShippingQuote({ status: "idle" });
      return true;
    }

    const quoteAddress = normalizeManualAddress(address);
    const streetValid = quoteAddress.street.length >= 2 && isSafeUserNote(quoteAddress.street);
    const numberValid = /^[0-9A-Za-z\s/-]{1,30}$/.test(quoteAddress.number);
    const cityValid = quoteAddress.city.trim().length >= 2 && isSafeUserNote(quoteAddress.city);
    const provinceValid = quoteAddress.province.trim().length >= 2 && isSafeUserNote(quoteAddress.province);

    if (
      quoteAddress.street !== address.street
      || quoteAddress.number !== address.number
      || quoteAddress.placeId !== address.placeId
    ) {
      setAddress(quoteAddress);
    }

    if (!streetValid || !numberValid || !cityValid || !provinceValid) {
      setShippingQuote({
        status: "error",
        message: "Completá calle, número, ciudad y provincia. Podés escribir la dirección manualmente (por ejemplo, Córdoba 1452) o elegir una sugerencia de Google Maps."
      });
      return false;
    }

    setShippingQuote({ status: "loading" });
    const response = await fetch("/api/shipping/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quoteAddress)
    });
    const data = (await response.json()) as {
      available?: boolean;
      amount?: number;
      distanceKm?: number;
      durationText?: string;
      origin?: string;
      destination?: string;
      reason?: string;
      message?: string;
    };
    if (!response.ok || !data.available) {
      setShippingQuote({
        status: "error",
        message: data.reason || data.message || "No pudimos cotizar el envío con esa dirección.",
        distanceKm: data.distanceKm
      });
      return false;
    }
    setShippingQuote({
      status: "ok",
      amount: Number(data.amount ?? 0),
      distanceKm: Number(data.distanceKm ?? 0),
      durationText: data.durationText,
      origin: String(data.origin || "FZAC Materiales, Rosario"),
      destination: String(data.destination || [quoteAddress.street, quoteAddress.number, quoteAddress.city, quoteAddress.province].filter(Boolean).join(", "))
    });
    return true;
  }

  useEffect(() => {
    if (!hydrated || !items.length) return;
    const controller = new AbortController();
    window.queueMicrotask(() => {
      validateStock(controller.signal).catch(() => {
        if (!controller.signal.aborted) setStockState({ status: "error", message: "No pudimos validar la disponibilidad.", items: [] });
      });
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, items]);

  useEffect(() => {
    if (shippingMethod !== "DELIVERY" || !streetInputRef.current) return;
    let cancelled = false;
    let listener: { remove?: () => void } | null = null;
    void loadGoogleMapsPlaces().then((ready) => {
      if (cancelled || !ready || !streetInputRef.current) return;
      setPlacesReady(true);
      const mapsWindow = window as GoogleMapsWindow;
      const Autocomplete = mapsWindow.google?.maps?.places?.Autocomplete;
      if (!Autocomplete) return;
      const autocomplete = new Autocomplete(streetInputRef.current, {
        componentRestrictions: { country: "ar" },
        fields: ["address_components", "formatted_address", "place_id"],
        types: ["address"]
      });
      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const components = place.address_components;
        const placeId = place.place_id?.trim() ?? "";
        const street = placePart(components, "route");
        const number = placePart(components, "street_number");
        const city = placePart(components, "locality") || placePart(components, "administrative_area_level_2");
        const province = placePart(components, "administrative_area_level_1");
        const postalCode = placePart(components, "postal_code");
        setAddress((current) => ({
          ...current,
          placeId,
          street: street || current.street,
          number: number || current.number,
          city: city || current.city || "Rosario",
          province: province || current.province || "Santa Fe",
          postalCode: postalCode || current.postalCode
        }));
        setShippingQuote({ status: "idle" });
      });
    });
    return () => {
      cancelled = true;
      listener?.remove?.();
    };
  }, [shippingMethod]);

  useEffect(() => {
    if (!termsOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTermsOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [termsOpen]);

  function choosePickup() {
    setShippingMethod("PICKUP");
    setShippingQuote({ status: "idle" });
    setError("");
  }

  function goToDelivery() {
    if (!basicCustomerComplete) {
      setError("Completá nombre, email y teléfono con formato válido para continuar.");
      return;
    }
    setError("");
    setStep("delivery");
  }

  async function goToReview() {
    if (addressStates.notes.status === "invalid") {
      setError(addressStates.notes.message);
      return;
    }
    setError("");
    setLoading(true);
    setProcessPhase(shippingMethod === "DELIVERY" ? "shipping" : "validating");
    try {
      if (!(await quoteShipping())) return;
      setStep("review");
    } finally {
      setLoading(false);
    }
  }

  async function goToConfirm() {
    if (orderNotesState.status === "invalid") {
      setError(orderNotesState.message);
      return;
    }
    setError("");
    setLoading(true);
    setProcessPhase("validating");
    try {
      if (!(await quoteShipping())) return;
      if (await validateStock()) setStep("confirm");
    } finally {
      setLoading(false);
    }
  }

  async function submitOrder() {
    if (loading || checkoutInFlightRef.current || !accepted || stockState.status !== "ok") return;
    checkoutInFlightRef.current = true;
    setLoading(true);
    setError("");
    setProcessPhase(shippingMethod === "DELIVERY" ? "shipping" : "validating");

    try {
      if (!(await quoteShipping())) return;
      setProcessPhase("validating");
      if (!(await validateStock())) return;
      setProcessPhase("creating");

      const response = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: checkoutItems(items),
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: normalizeArgentinePhone(customer.phone),
          shipping_method: shippingMethod,
          address_snapshot: checkoutAddressSnapshot(),
          notes: normalizeUserNote(notes, 500),
          payment_method: "WHATSAPP",
          payment_flow: "WHATSAPP",
          accepted_terms: true,
          idempotency_key: getIntentKey()
        })
      });

      const data = (await response.json()) as {
        orderId?: string;
        order_id?: string;
        whatsapp_url?: string;
        whatsappUrl?: string;
        redirect_url?: string;
        url?: string;
        message?: string;
        error?: string;
        items?: StockIssue[];
        total?: number;
      };

      if (!response.ok) {
        if (response.status === 409 && data.error === "INSUFFICIENT_STOCK") {
          setStockState({ status: "error", message: data.message || "Revisá la disponibilidad del pedido.", items: data.items ?? [] });
          setStep("review");
          return;
        }
        if (response.status === 422 && data.error === "SHIPPING_QUOTE_UNAVAILABLE") {
          setError(data.message || "No pudimos cotizar el envío.");
          setStep("delivery");
          return;
        }
        if (data.error === "IDEMPOTENCY_CONFLICT" || data.error === "PRICE_CHANGED") {
          clearIntent();
          setError(data.message || "El pedido cambió. Revisalo y volvé a confirmarlo.");
          setStep("review");
          return;
        }
        throw new Error(data.message || "No pudimos generar el pedido.");
      }

      const orderId = String(data.orderId || data.order_id || "").trim();
      if (!orderId) throw new Error("El pedido se creó sin una referencia válida.");

      const reference = orderId.slice(0, 8).toUpperCase();
      const authoritativeTotal = Number.isFinite(Number(data.total)) ? Number(data.total) : total;
      const productMessageLines = items.flatMap((item) => {
        const pricing = productLinePricing(item.product, item.quantity);
        const regularLineTotal = item.product.price * item.quantity;
        const promotionApplied = Math.abs(regularLineTotal - pricing.total) >= 1;
        return [
          `• ${item.product.name} (${item.product.sku})`,
          `  ${item.quantity} x ${currency(item.product.price)} c/u = ${currency(pricing.total)}${promotionApplied ? " (promo aplicada)" : ""}`
        ];
      });
      const whatsappUrl = getWhatsAppHref([
        `Hola FZAC, generé el pedido #${reference} a nombre de ${customer.name.trim()}.`,
        "",
        "Productos:",
        ...productMessageLines,
        "",
        `Subtotal productos: ${currency(subtotal)}`,
        shippingMethod === "DELIVERY" ? `Envío: ${currency(shippingCost)}` : "Retiro: sin costo",
        shippingMethod === "DELIVERY"
          ? `Total con envío: ${currency(authoritativeTotal)}`
          : `Total final: ${currency(authoritativeTotal)}`,
        "",
        "Quiero coordinar el pago por transferencia y la entrega/retiro."
      ].join("\n"));

      const snapshot: LastOrderSnapshot = {
        orderId,
        whatsappUrl,
        total: authoritativeTotal,
        shippingMethod,
        message: data.message || "Pedido generado correctamente. Coordiná el pago y la entrega con FZAC por WhatsApp.",
        createdAt: Date.now()
      };
      window.sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(snapshot));
      clearIntent();
      clearCart();
      setProcessPhase("confirming");
      router.push(`/checkout/confirmado?orderId=${encodeURIComponent(orderId)}`);
    } catch (checkoutError) {
      setProcessPhase("error");
      setError(checkoutError instanceof Error ? checkoutError.message : "No pudimos generar el pedido.");
      setLoading(false);
      checkoutInFlightRef.current = false;
    }
  }

  function progressClass(target: CheckoutStep) {
    const targetIndex = steps.findIndex((item) => item.id === target);
    if (targetIndex < stepIndex) return "completed";
    if (target === step) return "active";
    return "";
  }

  if (!hydrated) {
    return (
      <main className="page-section">
        <div className="container empty-state"><div><Package size={38} /><h1>Cargando pedido</h1><p>Estamos preparando tu carrito.</p></div></div>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="page-section">
        <div className="container empty-state"><div><Package size={38} /><h1>No hay productos en el carrito</h1><p>Agregá productos antes de iniciar el pedido.</p><Link className="btn" href="/productos">Ver productos</Link></div></div>
      </main>
    );
  }

  return (
    <main className="page-section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="kicker">Pedido FZAC</span>
            <h1>Confirmá tu pedido</h1>
            <p>Completá tus datos, elegí retiro o envío y coordiná el pago directamente con FZAC por WhatsApp.</p>
          </div>
        </div>

        <div className="checkout-confidence" aria-label="Garantías del pedido">
          <div><Clock3 size={18} /><span><strong>4 pasos claros</strong> antes de confirmar</span></div>
          <div><LockKeyhole size={18} /><span><strong>Sin datos de tarjeta</strong> en la web</span></div>
          <div><BadgeCheck size={18} /><span><strong>Stock y total revisados</strong> antes de coordinar</span></div>
        </div>

        <div className="checkout-progress">
          {steps.map((item, index) => (
            <span className={progressClass(item.id)} key={item.id}><b>{index + 1}</b><small>{item.label}</small></span>
          ))}
        </div>

        <div className={`checkout-layout ${step === "confirm" ? "checkout-layout--payment" : ""}`} data-checkout-form="true">
          {step !== "confirm" ? (
            <div className="checkout-steps">
              {step === "customer" ? (
                <section className="checkout-panel">
                  <h2><UserRound size={18} /> Datos del comprador</h2>
                  <p className="checkout-panel__hint">Los usamos para identificar el pedido y contactarte.</p>
                  <div className="form-grid">
                    <label>Nombre y apellido<input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} autoComplete="name" />{validationMessage(customerStates.name)}</label>
                    <label>Email<input type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} autoComplete="email" />{validationMessage(customerStates.email)}</label>
                    <label>Teléfono<input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: normalizeArgentinePhone(limitPhoneInput(event.target.value)) })} autoComplete="tel" inputMode="tel" maxLength={18} />{validationMessage(customerStates.phone)}<small className="checkout-field-help">{normalizePhoneDigits(customer.phone).length}/13 dígitos.</small></label>
                  </div>
                  {error ? <p className="notice notice--danger">{error}</p> : null}
                  <div className="checkout-panel__actions"><button className="btn" ref={primaryActionRef} type="button" disabled={loading} onClick={goToDelivery}>Continuar <ArrowRight size={17} /></button></div>
                </section>
              ) : null}

              {step === "delivery" ? (
                <section className="checkout-panel">
                  <h2><Truck size={18} /> Entrega o retiro</h2>
                  <div className="checkout-methods">
                    <button type="button" className="method-button" aria-pressed={shippingMethod === "PICKUP"} onClick={choosePickup}><Package size={20} /><strong>Retiro coordinado</strong><span>Retirás en FZAC cuando confirmemos disponibilidad.</span></button>
                    <button type="button" className="method-button" aria-pressed={shippingMethod === "DELIVERY"} onClick={() => { setShippingMethod("DELIVERY"); setShippingQuote({ status: "idle" }); setError(""); }}><Truck size={20} /><strong>Envío cotizado</strong><span>Calculamos el costo según la dirección que escribas o selecciones.</span></button>
                    <a className="method-button" href={deliveryHref} target="_blank" rel="noreferrer"><MessageCircle size={20} /><strong>Consultar antes</strong><span>Para pedidos o zonas especiales.</span></a>
                  </div>

                  {shippingMethod === "DELIVERY" ? (
                    <div className="checkout-subpanel">
                      <h3><MapPin size={17} /> Dirección de entrega</h3>
                      <p>Podés escribir la dirección manualmente o elegir una sugerencia de Google Maps. Si escribís “Córdoba 1452”, completamos la altura automáticamente.</p>
                      <div className="form-grid checkout-address-grid">
                        <label>Calle<input ref={streetInputRef} value={address.street} onChange={(event) => updateAddressField("street", event.target.value)} onBlur={normalizeStreetAndNumber} autoComplete="address-line1" placeholder="Ej.: Córdoba 1452" />{validationMessage(addressStates.street)}<small className="checkout-field-help">{address.placeId ? "Dirección vinculada con Google Maps." : placesReady ? "Podés elegir una sugerencia o escribir la dirección manualmente." : "Podés escribir la dirección completa manualmente."}</small></label>
                        <label>Número<input value={address.number} onChange={(event) => updateAddressField("number", event.target.value)} inputMode="numeric" maxLength={30} />{validationMessage(addressStates.number)}</label>
                        <label>Departamento (opcional)<input value={address.apartment} onChange={(event) => updateAddressField("apartment", event.target.value)} autoComplete="address-line2" /></label>
                        <label>Ciudad<input value={address.city} onChange={(event) => updateAddressField("city", event.target.value)} autoComplete="address-level2" />{validationMessage(addressStates.city)}</label>
                        <label>Provincia<input value={address.province} onChange={(event) => updateAddressField("province", event.target.value)} autoComplete="address-level1" />{validationMessage(addressStates.province)}</label>
                        <label>Código postal (opcional)<input value={address.postalCode} onChange={(event) => updateAddressField("postalCode", event.target.value)} autoComplete="postal-code" /></label>
                      </div>
                      <div className="checkout-subpanel__actions"><button className="btn" type="button" disabled={shippingQuote.status === "loading"} onClick={() => void quoteShipping()}>{shippingQuote.status === "loading" ? <Loader2 size={17} /> : <Truck size={17} />} Cotizar envío</button></div>
                      {shippingQuote.status === "ok" ? (
                        <div className="checkout-shipping-quote" role="status" aria-live="polite">
                          <div className="checkout-shipping-quote__head"><Truck size={18} /><div><strong>Envío calculado</strong><span>{currency(shippingQuote.amount)}</span></div></div>
                          <div className="checkout-shipping-route"><div><small>Desde</small><strong>{shippingQuote.origin}</strong></div><ArrowRight size={18} /><div><small>Hasta</small><strong>{shippingQuote.destination}</strong></div></div>
                          <div className="checkout-shipping-quote__meta"><span><strong>{shippingQuote.distanceKm} km</strong> de recorrido</span>{shippingQuote.durationText ? <span><strong>{shippingQuote.durationText}</strong> estimados</span> : null}<span><strong>{currency(total)}</strong> total con envío</span></div>
                        </div>
                      ) : null}
                      {shippingQuote.status === "error" ? (
                        <div className="notice notice--danger checkout-shipping-fallback"><p>{shippingQuote.message}{shippingQuote.distanceKm ? ` Distancia detectada: ${shippingQuote.distanceKm} km.` : ""}</p><div><button type="button" onClick={choosePickup}><Package size={16} /> Elegir retiro $0</button><a href={deliveryHref} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Coordinar por WhatsApp</a></div></div>
                      ) : null}
                    </div>
                  ) : null}

                  {error ? <p className="notice notice--danger">{error}</p> : null}
                  <div className="checkout-panel__actions"><button className="btn btn--ghost" type="button" disabled={loading} onClick={() => setStep("customer")}><ArrowLeft size={17} /> Volver</button><button className="btn" ref={primaryActionRef} type="button" disabled={loading} onClick={() => void goToReview()}>{loading ? <Loader2 size={17} /> : <ArrowRight size={17} />} Continuar</button></div>
                </section>
              ) : null}

              {step === "review" ? (
                <section className="checkout-panel">
                  <h2><ShieldCheck size={18} /> Revisión del pedido</h2>
                  <div className="payment-note"><ShieldCheck size={18} /><p>Los productos con “Stock a confirmar” pueden pedirse normalmente. FZAC confirma la cantidad final por WhatsApp antes de cobrar.</p></div>
                  <label className="field" style={{ marginTop: 14 }}>Notas del pedido<textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 500))} maxLength={500} placeholder="Ej.: horario de retiro, aclaración de obra o referencia." />{validationMessage(orderNotesState)}</label>
                  {stockState.status === "loading" ? <p className="notice">Validando disponibilidad...</p> : null}
                  {stockState.status === "ok" ? <p className="notice notice--success">Pedido validado. Podés continuar.</p> : null}
                  {stockState.status === "error" ? <div className="notice notice--danger"><strong>{stockState.message}</strong>{stockState.items.length ? <ul className="stock-issue-list">{stockState.items.map((item) => <li key={item.productId}>{item.name ?? item.productId}: pediste {item.requested}, disponibles {item.available}.</li>)}</ul> : null}<a className="checkout-help-link checkout-help-link--danger" href={helpHref} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Consultar con FZAC</a></div> : null}
                  {error ? <p className="notice notice--danger">{error}</p> : null}
                  <div className="checkout-panel__actions"><button className="btn btn--ghost" type="button" disabled={loading} onClick={() => setStep("delivery")}><ArrowLeft size={17} /> Volver</button><button className="btn" ref={primaryActionRef} type="button" disabled={loading || stockState.status === "loading"} onClick={() => void goToConfirm()}>{loading ? <Loader2 size={17} /> : <ArrowRight size={17} />} Revisar confirmación</button></div>
                </section>
              ) : null}
            </div>
          ) : null}

          <aside className={`checkout-summary ${step === "confirm" ? "checkout-summary--final" : ""}`}>
            <h2>{step === "confirm" ? "Confirmación" : "Resumen"}</h2>
            <button className="checkout-summary-toggle" type="button" aria-controls="checkout-order-summary" aria-expanded={mobileSummaryOpen} onClick={() => setMobileSummaryOpen((current) => !current)}><span><small>Tu pedido</small><strong>{items.length} {items.length === 1 ? "producto" : "productos"} · {currency(total)}</strong></span><ChevronDown size={20} /></button>
            <div className={`checkout-summary-details ${mobileSummaryOpen ? "is-open" : ""}`} id="checkout-order-summary">
              <div className="checkout-floating-products">
                {items.map((item) => {
                  const pricing = productLinePricing(item.product, item.quantity);
                  const promotion = promotionLabel(item.product);
                  const status = getProductAvailabilityStatus(item.product);
                  const limit = productQuantityLimit(item.product);
                  return (
                    <article className="checkout-floating-product" key={item.productId}>
                      <Image src={item.product.image_url} alt={item.product.name} width={58} height={58} />
                      <div><strong>{item.product.name}</strong><span>{item.quantity} x {currency(item.product.price)}{promotion ? ` · ${promotion}` : ""}</span><small className={status === "OUT_OF_STOCK" ? "status-pill status-pill--danger" : status === "CONSULT" ? "status-pill status-pill--warning" : "status-pill status-pill--success"}>{productAvailabilityLabel(item.product, { includeQuantity: status === "IN_STOCK" })}</small></div>
                      <div className="checkout-floating-product__actions"><strong>{currency(pricing.total)}</strong>{pricing.savings > 0 ? <small>Ahorrás {currency(pricing.savings)}</small> : null}<span><button type="button" aria-label={`Quitar una unidad de ${item.product.name}`} disabled={item.quantity <= 1} onClick={() => updateQuantity(item.productId, item.quantity - 1)}><Minus size={13} /></button><button type="button" aria-label={`Agregar una unidad de ${item.product.name}`} disabled={item.quantity >= limit} onClick={() => updateQuantity(item.productId, item.quantity + 1)}><Plus size={13} /></button><button type="button" aria-label={`Eliminar ${item.product.name} del pedido`} onClick={() => removeItem(item.productId)}><Trash2 size={13} /></button></span></div>
                    </article>
                  );
                })}
              </div>
              <div className="summary-line"><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
              <div className="summary-line"><span>{shippingMethod === "DELIVERY" ? "Envío" : "Retiro"}</span><strong>{shippingMethod === "DELIVERY" ? shippingQuote.status === "ok" ? currency(shippingQuote.amount) : "Pendiente de cotización" : "Sin costo"}</strong></div>
            </div>
            <div className="summary-total"><span>Total</span><strong>{currency(total)}</strong></div>

            {step === "confirm" ? (
              <>
                <div className="payment-method-hint"><MessageCircle size={18} /><div><strong>Coordinación por WhatsApp</strong><p>Al confirmar creamos el pedido y te llevamos a WhatsApp con la referencia. Ahí FZAC confirma stock, datos de transferencia y entrega o retiro.</p><span>No ingresás datos de tarjeta en la web.</span></div></div>
                <div className="terms-checkbox"><input type="checkbox" id="accept-terms" checked={accepted} onChange={(event) => event.target.checked ? setTermsOpen(true) : setAccepted(false)} /><div className="terms-checkbox__copy"><span>Acepto los </span><button className="terms-inline-button" type="button" onClick={() => setTermsOpen(true)}>Términos y condiciones</button><span> y la </span><Link href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad</Link>.</div></div>
                {error ? <p className="notice notice--danger">{error}</p> : null}
                <button className={`btn checkout-pay-button ${loading ? "checkout-pay-button--processing" : ""}`} ref={primaryActionRef} type="button" disabled={!accepted || loading || stockState.status !== "ok" || (shippingMethod === "DELIVERY" && shippingQuote.status !== "ok")} aria-busy={loading} onClick={() => void submitOrder()}>{loading ? <Loader2 size={18} /> : <MessageCircle size={18} />}{loading ? "Generando pedido..." : "Confirmar pedido y abrir WhatsApp"}</button>
                <button className="btn btn--ghost" type="button" disabled={loading} onClick={() => setStep("review")}><ArrowLeft size={17} /> Revisar datos</button>
              </>
            ) : <p className="checkout-summary__payment">Completá los pasos para confirmar el pedido por WhatsApp.</p>}
          </aside>
        </div>
      </div>

      {loading ? <CheckoutLoadingScreen method="WHATSAPP" phase={processPhase} errorMessage={error} /> : null}
      {termsOpen ? (
        <div className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-modal-title">
          <div className="terms-modal__panel">
            <header><div className="terms-modal__brand"><span><Image src="/logoFZAC.jpg" alt="FZAC" width={58} height={58} /></span><div><span className="kicker">Legal FZAC</span><h2 id="terms-modal-title">Términos y condiciones</h2></div></div><button className="terms-modal__close" type="button" onClick={() => setTermsOpen(false)} aria-label="Cerrar términos"><X size={19} /></button><p>Revisá las condiciones antes de generar el pedido.</p></header>
            <div className="terms-modal__content">
              <section><h3>Pedido y pago</h3><p>La confirmación web genera una solicitud de pedido. FZAC confirma disponibilidad y envía por WhatsApp los datos para coordinar la transferencia. El pedido no se considera pagado hasta que FZAC verifica el ingreso.</p></section>
              <section><h3>Stock a confirmar</h3><p>Los productos marcados como “Stock a confirmar” pueden incluirse en el pedido. La cantidad definitiva se valida con FZAC antes del pago.</p></section>
              <section><h3>Entrega y retiro</h3><p>El envío se cotiza con la dirección escrita o seleccionada. Los horarios y condiciones finales se coordinan luego de confirmar el pedido.</p></section>
              <section><h3>Derecho de revocación</h3><p>Conforme a la normativa aplicable, las compras a distancia cuentan con los derechos de revocación que correspondan según el producto y la operación.</p></section>
              <section><h3>Privacidad</h3><p>FZAC no solicita ni almacena datos de tarjeta en este flujo. Solo se procesan los datos necesarios para identificar, coordinar y entregar el pedido.</p></section>
            </div>
            <footer><Link className="btn btn--ghost" href="/terminos" target="_blank" rel="noopener noreferrer">Ver texto completo</Link><button className="btn btn--ghost" type="button" onClick={() => setTermsOpen(false)}>Volver</button><button className="btn" type="button" onClick={() => { setAccepted(true); setTermsOpen(false); }}>Acepto términos y condiciones</button></footer>
          </div>
        </div>
      ) : null}
    </main>
  );
}
