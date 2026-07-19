"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Info, Search, X } from "lucide-react";
import { AdminRefundAction } from "@/components/admin/admin-refund-action";

type AdminTableRow = Record<string, string | number | null | undefined>;
type AdminTab = { label: string; match: (row: AdminTableRow) => boolean };

const pageSize = 12;

function cellText(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function rowText(row: AdminTableRow) {
  return Object.values(row).map(cellText).join(" ").toLowerCase();
}

function parseAdminDate(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function tabOptionsFor(title: string): AdminTab[] {
  const normalized = title.toLowerCase();
  const includes = (word: string) => (row: AdminTableRow) => rowText(row).includes(word.toLowerCase());
  const statusIncludes = (word: string) => (row: AdminTableRow) => cellText(row.Estado).toLowerCase().includes(word.toLowerCase());

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
  const key = keys.find((candidate) => cellText(row[candidate]) !== "-");
  return key ? cellText(row[key]) : "-";
}

function documentCopy(kind: ReturnType<typeof documentKindFor>) {
  if (kind === "ticket") {
    return {
      kicker: "Tickets FZAC",
      title: "Tickets generados por estado de pago",
      text: "Cada ticket queda como respaldo operativo del pedido y toma el estado real del pago o aprobacion."
    };
  }
  if (kind === "receipt") {
    return {
      kicker: "Comprobantes de pago",
      title: "Facturas y comprobantes listos para revisar",
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
    const values = Array.from(new Set(rows.map((row) => cellText(row[statusColumn])).filter((value) => value !== "-")));
    return ["Todos", ...values.slice(0, 8)];
  }, [rows, statusColumn]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesQuery =
          !normalizedQuery ||
          columns.some((column) => cellText(row[column]).toLowerCase().includes(normalizedQuery));
        const matchesFilter = activeFilter === "Todos" || !statusColumn || cellText(row[statusColumn]) === activeFilter;
        const activeTabOption = tabs.find((tab) => tab.label === activeTab);
        const matchesTab = !activeTabOption || activeTabOption.match(row);
        const rowDate = dateColumn ? parseAdminDate(cellText(row[dateColumn])) : null;
        const matchesDateFrom = !dateFrom || !rowDate || rowDate >= dateFrom;
        const matchesDateTo = !dateTo || !rowDate || rowDate <= dateTo;
        return matchesQuery && matchesFilter && matchesTab && matchesDateFrom && matchesDateTo;
      }),
    [activeFilter, activeTab, columns, dateColumn, dateFrom, dateTo, normalizedQuery, rows, statusColumn, tabs]
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedTechnicalEntries = selectedRow
    ? Object.entries(selectedRow).filter(([key]) => !key.startsWith("__") && (technicalKey(key) || !visibleColumns.includes(key)))
    : [];

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
      ...filteredRows.map((row) => visibleColumns.map((column) => csvEscape(cellText(row[column]))).join(","))
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
          <h2>{documentKind ? "Listado para control administrativo" : "Gestion simple"}</h2>
        </div>
        <span className="status-pill">{filteredRows.length} registros</span>
      </div>

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
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar cliente, email, telefono, pedido o referencia..."
          />
        </label>
        <label className="admin-date-filter">
          Desde
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="admin-date-filter">
          Hasta
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <div className="admin-table-actions">
          <button className="btn btn--ghost" type="button" onClick={clearFilters} disabled={!query && activeFilter === "Todos" && activeTab === "Todos" && !dateFrom && !dateTo}>
            <X size={16} /> Limpiar
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

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {visibleColumns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? (
              visibleRows.map((row, index) => (
                <tr key={index} className="admin-table-row-clickable" onClick={() => setSelectedRow(row)}>
                  {visibleColumns.map((column) => (
                    <td data-label={column} key={column}>
                      {cellText(row[column])}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumns.length}>
                  <div className="admin-empty-state">
                    <Info size={18} />
                    No hay registros para mostrar con estos filtros.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
        <aside className="admin-row-drawer" aria-label={`Detalle de ${title}`}>
          <header>
            <div>
              <span className="kicker">Detalle</span>
              <h2>{title}</h2>
            </div>
            <button className="admin-icon-button" type="button" onClick={() => setSelectedRow(null)} aria-label="Cerrar detalle">
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
                Documento visual para control interno. La factura legal se emite con el comprobante aprobado.
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
          <dl>
            {visibleColumns.map((column) => (
              <div key={column}>
                <dt>{column}</dt>
                <dd>{cellText(selectedRow[column])}</dd>
              </div>
            ))}
          </dl>
          {selectedTechnicalEntries.length ? (
            <details className="admin-technical-details">
              <summary>Informacion tecnica</summary>
              <dl>
                {selectedTechnicalEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{cellText(value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}
