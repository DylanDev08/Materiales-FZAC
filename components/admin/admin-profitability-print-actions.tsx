"use client";

import { FileDown, Printer } from "lucide-react";

export function AdminProfitabilityPrintActions() {
  function printReport() {
    window.print();
  }

  return (
    <div className="admin-profitability-report__actions no-print">
      <button className="btn" type="button" onClick={printReport}>
        <FileDown size={17} />
        Guardar como PDF
      </button>
      <button className="btn btn--ghost" type="button" onClick={printReport}>
        <Printer size={17} />
        Imprimir
      </button>
    </div>
  );
}
