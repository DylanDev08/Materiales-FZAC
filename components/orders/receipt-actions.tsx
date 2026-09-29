"use client";

import { Download, Printer } from "lucide-react";

export function ReceiptActions({ orderId, reference }: { orderId: string; reference: string }) {
  return (
    <div className="receipt-actions">
      <a
        className="btn"
        href={`/api/orders/${encodeURIComponent(orderId)}/receipt-pdf`}
        download={`factura-fzac-${reference}.pdf`}
      >
        <Download size={18} />
        Descargar comprobante PDF
      </a>
      <button className="btn btn--ghost" type="button" onClick={() => window.print()}>
        <Printer size={18} />
        Imprimir
      </button>
    </div>
  );
}
