"use client";

import Link from "next/link";
import { Download, RotateCcw } from "lucide-react";

export function CatalogReportActions({ backHref, title }: { backHref: string; title: string }) {
  function exportPdf() {
    const previousTitle = document.title;
    const date = new Intl.DateTimeFormat("es-AR", { year: "numeric", month: "2-digit", day: "2-digit" })
      .format(new Date()).replaceAll("/", "-");
    document.title = `${title}-${date}`.replace(/\s+/g, "-");
    window.print();
    window.setTimeout(() => { document.title = previousTitle; }, 500);
  }

  return (
    <div className="catalog-report-actions no-print">
      <Link className="btn btn--ghost" href={backHref}><RotateCcw size={17} />Volver</Link>
      <button className="btn btn--primary" onClick={exportPdf} type="button"><Download size={17} />Imprimir / Guardar PDF</button>
    </div>
  );
}
