"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, ShoppingCart, X } from "lucide-react";

export type CartNoticeState = {
  id: number;
  kind: "success" | "error";
  productName: string;
  quantity: number;
};

export function CartNotice({ notice, onClose, onPauseChange }: { notice: CartNoticeState | null; onClose: () => void; onPauseChange: (paused: boolean) => void }) {
  if (!notice) return null;

  const success = notice.kind === "success";

  return (
    <div
      className={`cart-notice ${success ? "cart-notice--success" : "cart-notice--error"}`}
      role={success ? "status" : "alert"}
      aria-live={success ? "polite" : "assertive"}
      aria-atomic="true"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      onMouseEnter={() => onPauseChange(true)}
      onMouseLeave={(event) => {
        // Keep the notice visible while a keyboard user is on a button or link.
        onPauseChange(event.currentTarget.contains(document.activeElement));
      }}
      onFocusCapture={() => onPauseChange(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          // Moving focus out must not resume dismissal while it is still hovered.
          onPauseChange(event.currentTarget.matches(":hover"));
        }
      }}
    >
      <span className="cart-notice__icon" aria-hidden="true">
        {success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      </span>
      <div className="cart-notice__content">
        <strong>{success ? "Agregado al carrito" : "No se pudo agregar"}</strong>
        <p title={notice.productName}>
          {notice.productName}
          {success ? ` · ${notice.quantity} ${notice.quantity === 1 ? "unidad" : "unidades"}` : ""}
        </p>
        {success ? (
          <Link className="cart-notice__link" href="/carrito" onClick={onClose} prefetch={false}>
            <ShoppingCart size={15} /> Ver carrito
          </Link>
        ) : (
          <small>Revisá la cantidad o intentá nuevamente.</small>
        )}
      </div>
      <button type="button" className="cart-notice__close" aria-label="Cerrar aviso del carrito" onClick={onClose}>
        <X size={18} />
      </button>
    </div>
  );
}
