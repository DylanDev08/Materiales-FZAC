import Image from "next/image";
import { BadgeCheck, FileText, ShieldCheck } from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import type { OrderReceipt } from "@/lib/db/receipts";

function dateValue(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ReceiptTemplate({ receipt }: { receipt: NonNullable<OrderReceipt> }) {
  return (
    <section className="receipt-template" aria-label="Comprobante FZAC">
      <div className="receipt-template__stamp">FZAC</div>
      <header className="receipt-template__head">
        <div className="receipt-template__brand">
          <span className="receipt-template__logo">
            <Image src="/logoFZAC.jpg" alt="FZAC" width={62} height={62} unoptimized />
          </span>
          <div>
            <span className="kicker">Comprobante de compra</span>
            <h2>Fortaleza Construcciones</h2>
            <p>Hermana Paula 3164, Rosario, Santa Fe</p>
          </div>
        </div>
        <div className="receipt-template__number">
          <FileText size={22} />
          <strong>{receipt.number}</strong>
          <span>Ref. {receipt.reference}</span>
        </div>
      </header>

      <div className="receipt-template__grid">
        <article>
          <span>Cliente</span>
          <strong>{receipt.customer.name}</strong>
          <p>{receipt.customer.email}</p>
          <p>{receipt.customer.phone}</p>
        </article>
        <article>
          <span>Operacion</span>
          <strong>{dateValue(receipt.issuedAt)}</strong>
          <p>{receipt.payment.provider}</p>
          <p>{receipt.shipping.method}</p>
        </article>
        <article>
          <span>Direccion</span>
          <strong>{receipt.shipping.address}</strong>
          <p>{receipt.shipping.cost > 0 ? `Envio ${currency(receipt.shipping.cost)}` : "Envio sin cargo cargado o a coordinar"}</p>
        </article>
      </div>

      <div className="receipt-template__table">
        <div className="receipt-template__row receipt-template__row--head">
          <span>Material</span>
          <span>Cant.</span>
          <span>Precio</span>
          <span>Total</span>
        </div>
        {receipt.items.map((item) => (
          <div className="receipt-template__row" key={`${item.sku}-${item.name}`}>
            <span>
              <strong>{item.name}</strong>
              <small>{item.sku}</small>
            </span>
            <span>{item.quantity}</span>
            <span>{currency(item.unitPrice)}</span>
            <span>{currency(item.subtotal)}</span>
          </div>
        ))}
      </div>

      <div className="receipt-template__totals">
        <span>
          Subtotal <strong>{currency(receipt.amounts.subtotal)}</strong>
        </span>
        <span>
          IVA incluido 21% <strong>{currency(receipt.amounts.ivaIncluded)}</strong>
        </span>
        <span>
          Envio <strong>{receipt.amounts.shippingCost > 0 ? currency(receipt.amounts.shippingCost) : "A coordinar / sin cargo"}</strong>
        </span>
        <span className="receipt-template__grand">
          Total <strong>{currency(receipt.amounts.total)}</strong>
        </span>
      </div>

      <footer className="receipt-template__foot">
        <div>
          <BadgeCheck size={18} />
          <span>Comprobante emitido por sistema FZAC. Stock descontado solo con pago aprobado.</span>
        </div>
        <div className="receipt-template__signature">
          <ShieldCheck size={18} />
          <strong>Firma digital FZAC</strong>
        </div>
      </footer>
    </section>
  );
}
