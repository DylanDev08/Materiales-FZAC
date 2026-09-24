"use client";

import Link from "next/link";
import { Download, Printer, RotateCcw } from "lucide-react";

function printReport(asPdf: boolean) {
  const previousTitle = document.title;
  if (asPdf) {
    const date = new Intl.DateTimeFormat("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .format(new Date())
      .replaceAll("/", "-");
    document.title = `FZAC-Rentabilidad-${date}`;
  }

  window.print();

  window.setTimeout(() => {
    document.title = previousTitle;
  }, 500);
}

export function ProfitabilityReportActions({ backHref }: { backHref: string }) {
  return (
    <div className="profit-report-actions no-print">
      <Link className="btn btn--ghost" href={backHref}>
        <RotateCcw size={17} /> Volver a rentabilidad
      </Link>
      <button className="btn btn--ghost" type="button" onClick={() => printReport(false)}>
        <Printer size={17} /> Imprimir
      </button>
      <button className="btn" type="button" onClick={() => printReport(true)}>
        <Download size={17} /> Exportar PDF
      </button>
    </div>
  );
}
