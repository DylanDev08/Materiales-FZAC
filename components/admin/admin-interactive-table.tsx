"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Info, Search, X } from "lucide-react";
import { AdminRefundAction } from "@/components/admin/admin-refund-action";
import { AdminConsumerRequestAction } from "@/components/admin/admin-consumer-request-action";
import {
  adminCellText,
  filterAdminRows,
  paginateAdminRows,
  type AdminTableRow
} from "@/lib/admin/table-view";

type AdminTab = { label: string; match: (row: AdminTableRow) => boolean };

const pageSize = 12;

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function rowText(row: AdminTableRow) {
  return Object.values(row).map(adminCellText).join(" ").toLowerCase();
}

function tabOptionsFor(title: string): AdminTab[] {
  const normalized = title.toLowerCase();
  const includes = (word: string) => (row: AdminTableRow) => rowText(row).includes(word.toLowerCase());
  const statusIncludes = (word: string) => (row: AdminTableRow) => adminCellText(row.Estado).toLowerCase().includes(word.toLowerCase());

  if (normalized.includes("ticket")) {
    return [
      { label: "Todos", match: () => true },
      { label: "Aprobados", match: statusIncludes("aprob") },
      { label: "En revision", match: (row) => statusIncludes("revis")(row) || statusIncludes("revision")(row) },
      { label: "Pendientes", match: statusIncludes("pend") },
      { label: "Rechazados", match: (row) => statusIncludes("deneg")(row) || statusIncludes("rechaz")(row) },
      { label: "Cancelados", match: statusIncludes("cancel") }
    ];
  }

  if (normalized.includes("pago")) {
    return [
      { label: "Todos", match: () => true },
      { label: "Mercado Pago", match: includes("mercado pago") },
      { label: "Transferencia", match: includes("transferencia") },
      { label: "WhatsApp", match: includes("whatsapp") },
      { label: "Aprobados", match: (row) => statusIncludes("aprob")(row) || statusIncludes("pagado")(row) },
      { label: "Pendientes", match: statusIncludes("pend") },
      { label: "Rechazados", match: (row) => statusIncludes("deneg")(row) || statusIncludes("rechaz")(row) }
    ];
  }

  if (normalized.includes("actividad")) {
    return ["Todos", "Aprobado", "Pendiente", "Denegado", "Pedido", "Pago", "Ticket", "Stock", "Cliente", "Chatbot"].map((label) => ({
      label,
      match: label === "Todos" ? () => true : includes(label)
    }));
  }

  if (normalized.includes("arrepentimiento")) {
    return [
      { label: "Todos", match: () => true },
      { label: "Recibidas", match: statusIncludes("recibid") },
      { label: "En revisión", match: statusIncludes("revisi") },
      { label: "Aprobadas", match: statusIncludes("aprob") },
      { label: "Rechazadas", match: statusIncludes("rechaz") },
      { label: "Cerradas", match: statusIncludes("cerrad") }
    ];
  }

  return [];
}

function technicalKey(key: string) {
  return /^__|uuid|raw|json|id$|provider|preferencia|evento|referencia mercado/i.test(key);
}

function documentKindFor(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("ticket")) return "ticket";
  if (normalized.includes("comprobante") || normalized.includes("comprobacion")) return "receipt";
  if (normalized.includes("pago")) return "payment";
  return null;
}

function firstValue(row: AdminTableRow, keys: string[]) {
  const key = keys.find((candidate) => adminCellText(row[candidate]) !== "-");
  return key ? adminCellText(row[key]) : "-";
}

function documentCopy(kind: ReturnType<typeof documentKindFor>) {
  if (kind === "ticket") {
    return {
      kicker: "Tickets FZAC",
      title: "Tickets generados por estado de pago",
      text: "Cada ticket queda como respaldo operativo del pedido y toma el estado real del pago o aprobación."
    };
  }
  if (kind === "receipt") {
    return {
      kicker: "Comprobantes de pago",
      title: "Comprobantes de compra listos para revisar",
      text: "Cada movimiento se puede abrir como documento FZAC para controlar proveedor, estado, pedido y fecha."
    };
  }
  return {
    kicker: "Pagos FZAC",
    title: "Control de cobros y aprobaciones",
    text: "Los pagos quedan separados por proveedor y estado para evitar cobros duplicados o pedidos sin confirmar."
  };
}

export function AdminInteractiveTable({
  columns,
  rows,
  title
}: {
  columns: string[];
  rows: AdminTableRow[];
  title: string;
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [activeTab, setActiveTab] = useState("Todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<AdminTableRow | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const statusColumn = columns.find((column) => ["Estado", "Estado del pago", "Activa"].includes(column));
  const dateColumn = columns.find((column) => ["Fecha", "Registro", "Ultimo acceso", "Recibido", "Procesado", "Actualizado"].includes(column));
  const documentKind = documentKindFor(title);
  const documentHeader = documentCopy(documentKind);
  const tabs = useMemo(() => tabOptionsFor(title), [title]);
  const visibleColumns = useMemo(() => {
    const safeColumns = columns.filter((column) => !technicalKey(column));
    return safeColumns.length ? safeColumns : columns;
  }, [columns]);
  const filters = useMemo(() => {
    if (!statusColumn) return ["Todos"];
    const values = Array.from(new Set(rows.map((row) => adminCellText(row[statusColumn])).filter((value) => value !== "-")));
    return ["Todos", ...values.slice(0, 8)];
  }, [rows, statusColumn]);
  const activeTabOption = useMemo(() => tabs.find((tab) => tab.label === activeTab), [activeTab, tabs]);
  const filteredRows = useMemo(
    () => filterAdminRows(rows, {
      columns,
      query,
      statusColumn,
      status: activeFilter,
      dateColumn,
      dateFrom,
      dateTo,
      tabMatch: activeTabOption?.match
    }),
    [activeFilter, activeTabOption, columns, dateColumn, dateFrom, dateTo, query, rows, statusColumn]
  );
  const { currentPage, totalPages, rows: visibleRows } = paginateAdminRows(filteredRows, page, pageSize);
  const selectedTechnicalEntries = selectedRow
    ? Object.entries(selectedRow).filter(([key]) => !key.startsWith("__") && (technicalKey(key) || !visibleColumns.includes(key)))
    : [];

  const closeDetails = useCallback(() => {
    setSelectedRow(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!selectedRow) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>("button")?.focus());

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeDetails();
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeDetails, selectedRow]);

  function openDetails(row: AdminTableRow, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setSelectedRow(row);
  }

  function clearFilters() {
    setQuery("");
    setActiveFilter("Todos");
    setActiveTab("Todos");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function exportCsv() {
    const csv = [
      visibleColumns.map(csvEscape).join(","),
      ...filteredRows.map((row) => visibleColumns.map((column) => csvEscape(adminCellText(row[column]))).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replaceAll(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-panel admin-panel--table">
      {documentKind ? (
        <div className={`admin-document-hero admin-document-hero--${documentKind}`}>
          <div>
            <span className="kicker">{documentHeader.kicker}</span>
            <h2>{documentHeader.title}</h2>
            <p>{documentHeader.text}</p>
          </div>
          <strong>{filteredRows.length}</strong>
        </div>
      ) : null}

      <div className="admin-table-heading">
        <div>
          <span className="kicker">{title}</span>
          <h2>{documentKind ? "Listado para control administrativo" : "Registros y seguimiento"}</h2>
        </div>
        <span className="status-pill">{filteredRows.length} registros</span>
      </div>

      {documentKind ? (
        <p className="notice notice--info admin-document-retention">
          <strong>Registro protegido:</strong> limpiar la vista solo restablece filtros. Los tickets, pagos y comprobantes
          no se borran; sus cambios de estado permanecen disponibles para control y auditoría.
        </p>
      ) : null}

      {tabs.length ? (
        <div className="admin-filter-chips admin-filter-chips--tabs" aria-label={`Tabs de ${title}`}>
          {tabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              aria-pressed={activeTab === tab.label}
              onClick={() => {
                setActiveTab(tab.label);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="admin-table-controls admin-table-controls--advanced">
        <label className="admin-search">
          <Search size={18} />
          <span className="sr-only">Buscar en {title}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={`Buscar en ${title.toLocaleLowerCase("es-AR")}...`}
          />
        </label>
        {dateColumn ? <>
          <label className="admin-date-filter">
            Desde
            <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
          </label>
          <label className="admin-date-filter">
            Hasta
            <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
          </label>
        </> : null}
        <div className="admin-table-actions">
          <button className="btn btn--ghost" type="button" onClick={clearFilters} disabled={!query && activeFilter === "Todos" && activeTab === "Todos" && !dateFrom && !dateTo}>
            <X size={16} /> Limpiar vista
          </button>
          <button className="btn btn--ghost" type="button" onClick={exportCsv} disabled={!filteredRows.length}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {filters.length > 1 ? (
        <div className="admin-filter-chips" aria-label="Filtros de estado">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={activeFilter === filter}
              onClick={() => {
                setActiveFilter(filter);
                setPage(1);
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      ) : null}

      {visibleRows.length ? <div className="admin-mobile-record-list" aria-label={`Registros de ${title}`}>
        {visibleRows.map((row, index) => (
          <article key={`${currentPage}-${index}`}>
            <button type="button" onClick={(event) => openDetails(row, event.currentTarget)} aria-haspopup="dialog">
              <strong>{adminCellText(row[visibleColumns[0]])}</strong>
              <dl>
                {visibleColumns.slice(1, 5).map((column) => (
                  <div key={column}><dt>{column}</dt><dd>{adminCellText(row[column])}</dd></div>
                ))}
              </dl>
              <span>Ver detalle <ChevronRight size={16} /></span>
            </button>
          </article>
        ))}
      </div> : null}

      <div className="admin-table-wrap admin-table-wrap--responsive">
        <table className="admin-table">
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
                <tr
                  key={index}
                  className="admin-table-row-clickable"
                  tabIndex={0}
                  aria-label={`Abrir detalle del registro ${index + 1}`}
                  aria-haspopup="dialog"
                  onClick={(event) => openDetails(row, event.currentTarget)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDetails(row, event.currentTarget);
                    }
                  }}
                >
                  {visibleColumns.map((column) => (
                    <td data-label={column} key={column}>
                      {adminCellText(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!visibleRows.length ? (
        <div className="admin-empty-state admin-empty-state--actionable" role="status">
          <Info size={18} />
          <span>{rows.length ? "No hay resultados para los filtros aplicados." : `Todavía no hay registros en ${title.toLocaleLowerCase("es-AR")}.`}</span>
          {rows.length ? <button className="btn btn--ghost" type="button" onClick={clearFilters}>Limpiar filtros</button> : null}
        </div>
      ) : null}

      <footer className="admin-pagination">
        <span>
          Mostrando {visibleRows.length ? (currentPage - 1) * pageSize + 1 : 0} a {Math.min(currentPage * pageSize, filteredRows.length)} de{" "}
          {filteredRows.length}
        </span>
        <div>
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            <ChevronLeft size={15} /> Anterior
          </button>
          <strong>{currentPage}</strong>
          <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
            Siguiente <ChevronRight size={15} />
          </button>
        </div>
      </footer>

      {selectedRow ? (
        <>
        <button
          className="admin-row-drawer-backdrop"
          type="button"
          aria-label="Cerrar detalle"
          onClick={closeDetails}
        />
        <aside ref={drawerRef} className="admin-row-drawer" role="dialog" aria-modal="true" aria-label={`Detalle de ${title}`}>
          <header>
            <div>
              <span className="kicker">Detalle</span>
              <h2>{title}</h2>
            </div>
            <button className="admin-icon-button" type="button" onClick={closeDetails} aria-label="Cerrar detalle">
              <X size={18} />
            </button>
          </header>
          {documentKind ? (
            <section className={`admin-document-preview admin-document-preview--${documentKind}`}>
              <header>
                <div>
                  <span>FZAC Materiales</span>
                  <strong>{documentKind === "ticket" ? "Ticket de compra" : "Comprobante de pago"}</strong>
                </div>
                <b>{firstValue(selectedRow, ["Numero", "Referencia", "Pedido"])}</b>
              </header>
              <div className="admin-document-preview__body">
                <p>
                  <span>Cliente</span>
                  <strong>{firstValue(selectedRow, ["Cliente", "Email"])}</strong>
                </p>
                <p>
                  <span>Estado</span>
                  <strong>{firstValue(selectedRow, ["Estado"])}</strong>
                </p>
                <p>
                  <span>Fecha</span>
                  <strong>{firstValue(selectedRow, ["Fecha", "Recibido", "Procesado"])}</strong>
                </p>
                <p>
                  <span>Total</span>
                  <strong>{firstValue(selectedRow, ["Total", "Monto"])}</strong>
                </p>
              </div>
              <footer>
                Documento visual para control interno. No reemplaza una factura fiscal.
              </footer>
            </section>
          ) : null}
          {documentKind === "payment" ? (
            <AdminRefundAction
              paymentId={selectedRow.__paymentId ? String(selectedRow.__paymentId) : undefined}
              provider={selectedRow.__provider ? String(selectedRow.__provider) : undefined}
              status={selectedRow.__status ? String(selectedRow.__status) : undefined}
              reference={selectedRow.Referencia ? String(selectedRow.Referencia) : undefined}
            />
          ) : null}
          {title.toLowerCase().includes("arrepentimiento") ? (
            <AdminConsumerRequestAction
              requestId={selectedRow.__requestId ? String(selectedRow.__requestId) : undefined}
              requestNumber={selectedRow.__requestNumber ? String(selectedRow.__requestNumber) : undefined}
              status={selectedRow.__status ? String(selectedRow.__status) : undefined}
              details={selectedRow.__details ? String(selectedRow.__details) : undefined}
              resolutionNote={selectedRow.__resolutionNote ? String(selectedRow.__resolutionNote) : undefined}
              orderId={selectedRow.__orderId ? String(selectedRow.__orderId) : undefined}
            />
          ) : null}
          <dl>
            {visibleColumns.map((column) => (
              <div key={column}>
                <dt>{column}</dt>
                <dd>{adminCellText(selectedRow[column])}</dd>
              </div>
            ))}
          </dl>
          {selectedTechnicalEntries.length ? (
            <details className="admin-technical-details">
              <summary>Información técnica</summary>
              <dl>
                {selectedTechnicalEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{adminCellText(value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
        </aside>
        </>
      ) : null}
    </section>
  );
}
