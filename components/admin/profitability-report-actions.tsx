"use client";

import Link from "next/link";
import { Download, Printer, RotateCcw } from "lucide-react";

export function ProfitabilityReportActions({ backHref }: { backHref: string }) {
  return (
    <div className="profit-report-actions no-print">
      <Link className="btn btn--ghost" href={backHref}>
        <RotateCcw size={17} /> Volver a rentabilidad
      </Link>
      <button className="btn btn--ghost" type="button" onClick={() => window.print()}>
        <Printer size={17} /> Imprimir
      </button>
      <button className="btn" type="button" onClick={() => window.print()}>
        <Download size={17} /> Guardar como PDF
      </button>
    </div>
  );
}
