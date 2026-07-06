"use client";

import { Printer } from "lucide-react";

export function ReceiptActions() {
  return (
    <div className="receipt-actions">
      <button className="btn" type="button" onClick={() => window.print()}>
        <Printer size={18} />
        Imprimir o guardar PDF
      </button>
    </div>
  );
}
